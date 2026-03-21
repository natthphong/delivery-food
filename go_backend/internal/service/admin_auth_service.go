package service

import (
	"context"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type AdminAuthService struct {
	store           *repository.Store
	config          config.Config
	tokenManager    *backendauth.TokenManager
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewAdminAuthService(
	store *repository.Store,
	cfg config.Config,
	tokenManager *backendauth.TokenManager,
	accessTokenTTL time.Duration,
	refreshTokenTTL time.Duration,
) *AdminAuthService {
	return &AdminAuthService{
		store:           store,
		config:          cfg,
		tokenManager:    tokenManager,
		accessTokenTTL:  accessTokenTTL,
		refreshTokenTTL: refreshTokenTTL,
	}
}

func (s *AdminAuthService) Login(
	ctx context.Context,
	request dto.AdminLoginRequest,
	userAgent string,
	ipAddress string,
) (model.AdminAuthResponse, error) {
	username := strings.TrimSpace(request.Username)
	password := strings.TrimSpace(request.Password)
	if username == "" || password == "" {
		return model.AdminAuthResponse{}, apperror.BadRequest("username and password are required")
	}

	if s.isBootstrapCredentials(username, password) {
		session, err := s.bootstrapSession(ctx)
		if err != nil {
			return model.AdminAuthResponse{}, err
		}
		return s.issueTokens(ctx, session, nil, "bootstrap_admin", "bootstrap:"+username, userAgent, ipAddress)
	}

	record, err := s.store.GetStaffAccountSessionByUsername(ctx, username)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.AdminAuthResponse{}, apperror.Unauthorized("invalid admin credentials")
		}
		return model.AdminAuthResponse{}, apperror.Internal("failed to load staff account", err)
	}
	if record.Status != "active" || record.EmployeeStatus != "active" {
		return model.AdminAuthResponse{}, apperror.Forbidden("staff account is inactive")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(record.PasswordHash), []byte(password)); err != nil {
		return model.AdminAuthResponse{}, apperror.Unauthorized("invalid admin credentials")
	}

	session := model.AdminSession{
		SessionType:    "admin",
		ActorType:      "staff_account",
		ActorLabel:     record.FullName,
		StaffAccountID: &record.StaffAccountID,
		EmployeeID:     &record.EmployeeID,
		Roles:          record.Roles,
		Permissions:    record.Permissions,
		BranchIDs:      record.BranchIDs,
	}
	return s.issueTokens(ctx, session, &record.StaffAccountID, "staff_account", "staff:"+record.Username, userAgent, ipAddress)
}

func (s *AdminAuthService) Refresh(
	ctx context.Context,
	request dto.AdminRefreshRequest,
	userAgent string,
	ipAddress string,
) (model.AdminAuthResponse, error) {
	rawToken := strings.TrimSpace(request.RefreshToken)
	if rawToken == "" {
		return model.AdminAuthResponse{}, apperror.BadRequest("refreshToken is required")
	}

	record, err := s.store.GetAdminRefreshTokenByHash(ctx, backendauth.HashRefreshToken(rawToken))
	if err != nil {
		if repository.IsNotFound(err) {
			return model.AdminAuthResponse{}, apperror.Unauthorized("refresh session is invalid")
		}
		return model.AdminAuthResponse{}, apperror.Internal("failed to load refresh session", err)
	}
	if record.RevokedAt != nil || time.Now().After(record.ExpiresAt) {
		return model.AdminAuthResponse{}, apperror.Unauthorized("refresh session is expired")
	}

	switch record.ActorType {
	case "bootstrap_admin":
		session, err := s.bootstrapSession(ctx)
		if err != nil {
			return model.AdminAuthResponse{}, err
		}
		return s.rotateTokens(ctx, record.TokenHash, session, nil, "bootstrap_admin", "bootstrap:"+s.config.AdminUsername, userAgent, ipAddress)
	case "staff_account":
		if record.StaffAccountID == nil {
			return model.AdminAuthResponse{}, apperror.Unauthorized("refresh session is invalid")
		}
		account, err := s.store.GetStaffAccountSessionByID(ctx, *record.StaffAccountID)
		if err != nil {
			if repository.IsNotFound(err) {
				return model.AdminAuthResponse{}, apperror.Unauthorized("staff session is invalid")
			}
			return model.AdminAuthResponse{}, apperror.Internal("failed to load staff account", err)
		}
		if account.Status != "active" || account.EmployeeStatus != "active" {
			return model.AdminAuthResponse{}, apperror.Forbidden("staff account is inactive")
		}
		session := model.AdminSession{
			SessionType:    "admin",
			ActorType:      "staff_account",
			ActorLabel:     account.FullName,
			StaffAccountID: &account.StaffAccountID,
			EmployeeID:     &account.EmployeeID,
			Roles:          account.Roles,
			Permissions:    account.Permissions,
			BranchIDs:      account.BranchIDs,
		}
		return s.rotateTokens(ctx, record.TokenHash, session, &account.StaffAccountID, "staff_account", "staff:"+account.Username, userAgent, ipAddress)
	default:
		return model.AdminAuthResponse{}, apperror.Unauthorized("refresh session is invalid")
	}
}

func (s *AdminAuthService) Session(ctx context.Context, claims *backendauth.AccessClaims) (model.AdminSession, error) {
	if claims == nil || claims.SessionType != "admin" {
		return model.AdminSession{}, apperror.Unauthorized("admin session is required")
	}

	session := model.AdminSession{
		SessionType:    claims.SessionType,
		ActorType:      claims.ActorType,
		StaffAccountID: claims.StaffAccountID,
		EmployeeID:     claims.EmployeeID,
		Roles:          append([]string(nil), claims.Roles...),
		Permissions:    append([]string(nil), claims.Permissions...),
		BranchIDs:      append([]int64(nil), claims.BranchIDs...),
	}
	switch claims.ActorType {
	case "bootstrap_admin":
		session.ActorLabel = "Bootstrap owner"
	case "staff_account":
		if claims.StaffAccountID != nil {
			record, err := s.store.GetStaffAccountSessionByID(ctx, *claims.StaffAccountID)
			if err == nil {
				session.ActorLabel = record.FullName
			}
		}
	}
	return session, nil
}

func HashStaffPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(password)), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (s *AdminAuthService) isBootstrapCredentials(username string, password string) bool {
	return s.config.AdminUsername != "" &&
		s.config.AdminPassword != "" &&
		username == strings.TrimSpace(s.config.AdminUsername) &&
		password == strings.TrimSpace(s.config.AdminPassword)
}

func (s *AdminAuthService) bootstrapSession(ctx context.Context) (model.AdminSession, error) {
	if strings.TrimSpace(s.config.AdminUsername) == "" || strings.TrimSpace(s.config.AdminPassword) == "" {
		return model.AdminSession{}, apperror.Forbidden("bootstrap admin is not configured")
	}
	permissions, err := s.store.GetRolePermissions(ctx, "owner")
	if err != nil {
		return model.AdminSession{}, apperror.Internal("failed to load owner permissions", err)
	}
	branchIDs, err := s.store.ListAllBranchIDs(ctx)
	if err != nil {
		return model.AdminSession{}, apperror.Internal("failed to load branch scope", err)
	}
	return model.AdminSession{
		SessionType: "admin",
		ActorType:   "bootstrap_admin",
		ActorLabel:  "Bootstrap owner",
		Roles:       []string{"owner"},
		Permissions: permissions,
		BranchIDs:   branchIDs,
	}, nil
}

func (s *AdminAuthService) issueTokens(
	ctx context.Context,
	session model.AdminSession,
	staffAccountID *int64,
	actorType string,
	subject string,
	userAgent string,
	ipAddress string,
) (model.AdminAuthResponse, error) {
	accessToken, err := s.signAdminToken(session, subject)
	if err != nil {
		return model.AdminAuthResponse{}, err
	}
	refreshToken, refreshHash, err := backendauth.GenerateRefreshToken()
	if err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to mint refresh token", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to persist admin session", err)
	}
	defer tx.Rollback(ctx)

	if staffAccountID != nil {
		if err := s.store.TouchStaffAccountLogin(ctx, tx, *staffAccountID); err != nil {
			return model.AdminAuthResponse{}, apperror.Internal("failed to update staff login", err)
		}
	}
	if err := s.store.InsertAdminRefreshToken(ctx, tx, staffAccountID, actorType, refreshHash, time.Now().Add(s.refreshTokenTTL), userAgent, ipAddress); err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to persist refresh session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to commit admin session", err)
	}

	return model.AdminAuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Session:      session,
	}, nil
}

func (s *AdminAuthService) rotateTokens(
	ctx context.Context,
	oldHash string,
	session model.AdminSession,
	staffAccountID *int64,
	actorType string,
	subject string,
	userAgent string,
	ipAddress string,
) (model.AdminAuthResponse, error) {
	accessToken, err := s.signAdminToken(session, subject)
	if err != nil {
		return model.AdminAuthResponse{}, err
	}
	refreshToken, refreshHash, err := backendauth.GenerateRefreshToken()
	if err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to mint refresh token", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to rotate refresh session", err)
	}
	defer tx.Rollback(ctx)

	if err := s.store.RevokeAdminRefreshToken(ctx, tx, oldHash, refreshHash); err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to revoke refresh session", err)
	}
	if staffAccountID != nil {
		if err := s.store.TouchStaffAccountLogin(ctx, tx, *staffAccountID); err != nil {
			return model.AdminAuthResponse{}, apperror.Internal("failed to update staff login", err)
		}
	}
	if err := s.store.InsertAdminRefreshToken(ctx, tx, staffAccountID, actorType, refreshHash, time.Now().Add(s.refreshTokenTTL), userAgent, ipAddress); err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to persist refresh session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.AdminAuthResponse{}, apperror.Internal("failed to commit refresh session", err)
	}

	return model.AdminAuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Session:      session,
	}, nil
}

func (s *AdminAuthService) signAdminToken(session model.AdminSession, subject string) (string, error) {
	accessToken, err := s.tokenManager.SignAdminAccessToken(backendauth.AdminTokenInput{
		ActorType:      session.ActorType,
		ActorSubject:   subject,
		StaffAccountID: session.StaffAccountID,
		EmployeeID:     session.EmployeeID,
		Roles:          session.Roles,
		Permissions:    session.Permissions,
		BranchIDs:      session.BranchIDs,
	}, s.accessTokenTTL)
	if err != nil {
		return "", apperror.Internal("failed to sign access token", err)
	}
	return accessToken, nil
}
