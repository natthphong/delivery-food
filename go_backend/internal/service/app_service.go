package service

import (
	"context"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type AppService struct {
	store    *repository.Store
	notifier *NotificationService
}

func NewAppService(store *repository.Store, notifier *NotificationService) *AppService {
	return &AppService{store: store, notifier: notifier}
}

func (s *AppService) Bootstrap(ctx context.Context, userID int64) (model.Bootstrap, error) {
	user, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.Bootstrap{}, apperror.NotFound("user not found")
		}
		return model.Bootstrap{}, apperror.Internal("failed to load user", err)
	}

	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return model.Bootstrap{}, err
	}

	cart, err := s.store.GetCart(ctx, userID)
	if err != nil {
		return model.Bootstrap{}, apperror.Internal("failed to load cart", err)
	}

	return model.Bootstrap{
		User:   user,
		Config: configs,
		Cart:   cart,
	}, nil
}

func (s *AppService) UpdateProfile(ctx context.Context, userID int64, request dto.ProfilePatchRequest) (model.User, error) {
	if request.Email != nil && strings.TrimSpace(*request.Email) != "" && !strings.Contains(*request.Email, "@") {
		return model.User{}, apperror.BadRequest("email must be valid")
	}
	currentUser, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.User{}, apperror.NotFound("user not found")
		}
		return model.User{}, apperror.Internal("failed to load current user", err)
	}
	isEmailVerified := request.IsEmailVerified
	if request.Email != nil {
		nextEmail := strings.TrimSpace(*request.Email)
		currentEmail := strings.TrimSpace(stringValue(currentUser.Email))
		if nextEmail != "" && !strings.EqualFold(nextEmail, currentEmail) {
			value := false
			isEmailVerified = &value
		}
	}
	user, err := s.store.UpdateUserProfile(
		ctx,
		userID,
		normalizeOptionalString(request.DisplayName),
		normalizeOptionalString(request.Email),
		normalizeOptionalString(request.Phone),
		isEmailVerified,
		request.IsPhoneVerified,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "users_email_unique_ci") {
			return model.User{}, apperror.Conflict("email is already used")
		}
		if strings.Contains(strings.ToLower(err.Error()), "users_phone_unique") {
			return model.User{}, apperror.Conflict("phone is already used")
		}
		return model.User{}, apperror.Internal("failed to update profile", err)
	}
	return user, nil
}

func (s *AppService) SendVerificationEmail(ctx context.Context, userID int64, locale string) error {
	user, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		if repository.IsNotFound(err) {
			return apperror.NotFound("user not found")
		}
		return apperror.Internal("failed to load user", err)
	}
	if user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return apperror.BadRequest("email is required before verification")
	}
	if user.IsEmailVerified {
		return nil
	}
	if err := s.notifier.SendVerificationEmail(ctx, user, locale); err != nil {
		return apperror.Internal("failed to send verification email", err)
	}
	return nil
}

func (s *AppService) VerifyEmailToken(ctx context.Context, token string) (model.User, error) {
	if s.notifier == nil || s.notifier.tokenManager == nil {
		return model.User{}, apperror.Internal("email verification is not configured", nil)
	}
	claims, err := s.notifier.tokenManager.ParseEmailVerificationToken(strings.TrimSpace(token))
	if err != nil {
		return model.User{}, apperror.BadRequest("verification token is invalid or expired")
	}
	user, err := s.store.GetUserByID(ctx, claims.UserID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.User{}, apperror.NotFound("user not found")
		}
		return model.User{}, apperror.Internal("failed to load user", err)
	}
	if user.Email == nil || !strings.EqualFold(strings.TrimSpace(*user.Email), strings.TrimSpace(claims.Email)) {
		return model.User{}, apperror.Conflict("verification email does not match the current account email")
	}
	value := true
	updated, err := s.store.UpdateUserProfile(ctx, user.ID, nil, nil, nil, &value, nil)
	if err != nil {
		return model.User{}, apperror.Internal("failed to verify email", err)
	}
	return updated, nil
}

func (s *AppService) ListTransactions(ctx context.Context, userID int64, limit int) ([]model.TransactionSummary, error) {
	if limit <= 0 {
		limit = 50
	}
	items, err := s.store.ListTransactions(ctx, userID, limit)
	if err != nil {
		return nil, apperror.Internal("failed to load transactions", err)
	}
	for index := range items {
		items[index] = normalizeTransactionSummary(items[index])
	}
	return items, nil
}

func (s *AppService) ListOrders(ctx context.Context, userID int64, limit int) ([]model.Order, error) {
	if limit <= 0 {
		limit = 50
	}
	items, err := s.store.ListOrders(ctx, userID, limit)
	if err != nil {
		return nil, apperror.Internal("failed to load orders", err)
	}
	for index := range items {
		if items[index].Transaction != nil {
			normalized := normalizeTransactionSummary(*items[index].Transaction)
			items[index].Transaction = &normalized
		}
	}
	return items, nil
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}
