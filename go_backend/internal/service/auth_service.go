package service

import (
	"context"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type AuthService struct {
	store           *repository.Store
	verifier        backendauth.IdentityVerifier
	tokenManager    *backendauth.TokenManager
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewAuthService(
	store *repository.Store,
	verifier backendauth.IdentityVerifier,
	tokenManager *backendauth.TokenManager,
	accessTokenTTL time.Duration,
	refreshTokenTTL time.Duration,
) *AuthService {
	return &AuthService{
		store:           store,
		verifier:        verifier,
		tokenManager:    tokenManager,
		accessTokenTTL:  accessTokenTTL,
		refreshTokenTTL: refreshTokenTTL,
	}
}

func (s *AuthService) Login(
	ctx context.Context,
	request dto.AuthLoginRequest,
	userAgent string,
	ipAddress string,
) (dto.AuthTokensResponse, error) {
	var (
		authProvider string
		claims       model.IdentityClaims
		err          error
	)

	switch {
	case strings.TrimSpace(request.IDToken) != "":
		authProvider = "firebase"
		claims, err = s.verifier.VerifyFirebaseIDToken(ctx, request.IDToken)
		if err != nil {
			return dto.AuthTokensResponse{}, err
		}
	case request.LineProfile != nil:
		authProvider = "line"
		claims, err = claimsFromLineProfile(request.LineProfile)
		if err != nil {
			return dto.AuthTokensResponse{}, err
		}
	default:
		return dto.AuthTokensResponse{}, apperror.BadRequest("idToken or lineProfile is required")
	}

	user, err := s.store.UpsertUser(ctx, authProvider, claims)
	if err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to upsert user", err)
	}

	accessToken, refreshToken, err := s.issueTokens(ctx, user, userAgent, ipAddress)
	if err != nil {
		return dto.AuthTokensResponse{}, err
	}

	return dto.AuthTokensResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

func (s *AuthService) Refresh(
	ctx context.Context,
	request dto.RefreshRequest,
	userAgent string,
	ipAddress string,
) (dto.AuthTokensResponse, error) {
	rawToken := strings.TrimSpace(request.RefreshToken)
	if rawToken == "" {
		return dto.AuthTokensResponse{}, apperror.BadRequest("refreshToken is required")
	}

	record, err := s.store.GetRefreshTokenByHash(ctx, backendauth.HashRefreshToken(rawToken))
	if err != nil {
		if repository.IsNotFound(err) {
			return dto.AuthTokensResponse{}, apperror.Unauthorized("refresh session is invalid")
		}
		return dto.AuthTokensResponse{}, apperror.Internal("failed to load refresh session", err)
	}
	if record.RevokedAt != nil || time.Now().After(record.ExpiresAt) {
		return dto.AuthTokensResponse{}, apperror.Unauthorized("refresh session is expired")
	}

	user, err := s.store.GetUserByID(ctx, record.UserID)
	if err != nil {
		if repository.IsNotFound(err) {
			return dto.AuthTokensResponse{}, apperror.Unauthorized("user session is invalid")
		}
		return dto.AuthTokensResponse{}, apperror.Internal("failed to load user", err)
	}

	nextToken, nextHash, err := backendauth.GenerateRefreshToken()
	if err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to mint refresh token", err)
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to rotate refresh session", err)
	}
	defer tx.Rollback(ctx)

	if err := s.store.RevokeRefreshToken(ctx, tx, record.TokenHash, nextHash); err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to revoke refresh session", err)
	}
	if err := s.store.InsertRefreshToken(ctx, tx, user.ID, nextHash, time.Now().Add(s.refreshTokenTTL), userAgent, ipAddress); err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to persist refresh session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to commit refresh session", err)
	}

	accessToken, err := s.tokenManager.SignAccessToken(user.ID, user.AuthProvider, user.AuthSubject, s.accessTokenTTL)
	if err != nil {
		return dto.AuthTokensResponse{}, apperror.Internal("failed to sign access token", err)
	}

	return dto.AuthTokensResponse{
		AccessToken:  accessToken,
		RefreshToken: nextToken,
		User:         user,
	}, nil
}

func (s *AuthService) Me(ctx context.Context, userID int64) (model.User, error) {
	user, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.User{}, apperror.NotFound("user not found")
		}
		return model.User{}, apperror.Internal("failed to load user", err)
	}
	return user, nil
}

func (s *AuthService) issueTokens(ctx context.Context, user model.User, userAgent string, ipAddress string) (string, string, error) {
	accessToken, err := s.tokenManager.SignAccessToken(user.ID, user.AuthProvider, user.AuthSubject, s.accessTokenTTL)
	if err != nil {
		return "", "", apperror.Internal("failed to sign access token", err)
	}

	refreshToken, refreshHash, err := backendauth.GenerateRefreshToken()
	if err != nil {
		return "", "", apperror.Internal("failed to mint refresh token", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return "", "", apperror.Internal("failed to persist refresh session", err)
	}
	defer tx.Rollback(ctx)

	if err := s.store.InsertRefreshToken(ctx, tx, user.ID, refreshHash, time.Now().Add(s.refreshTokenTTL), userAgent, ipAddress); err != nil {
		return "", "", apperror.Internal("failed to persist refresh session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return "", "", apperror.Internal("failed to commit refresh session", err)
	}

	return accessToken, refreshToken, nil
}

func claimsFromLineProfile(profile *dto.LineProfileDTO) (model.IdentityClaims, error) {
	if profile == nil || strings.TrimSpace(profile.UserID) == "" {
		return model.IdentityClaims{}, apperror.BadRequest("lineProfile.userId is required")
	}
	claims := model.IdentityClaims{
		AuthSubject:     strings.TrimSpace(profile.UserID),
		ProviderLabel:   "liff",
		IsEmailVerified: false,
		IsPhoneVerified: false,
	}
	if profile.DisplayName != nil && strings.TrimSpace(*profile.DisplayName) != "" {
		value := strings.TrimSpace(*profile.DisplayName)
		claims.DisplayName = &value
	}
	if profile.Email != nil && strings.TrimSpace(*profile.Email) != "" {
		value := strings.TrimSpace(*profile.Email)
		claims.Email = &value
	}
	return claims, nil
}
