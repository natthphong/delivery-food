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
	store *repository.Store
}

func NewAppService(store *repository.Store) *AppService {
	return &AppService{store: store}
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
	user, err := s.store.UpdateUserProfile(
		ctx,
		userID,
		normalizeOptionalString(request.DisplayName),
		normalizeOptionalString(request.Email),
		normalizeOptionalString(request.Phone),
		request.IsEmailVerified,
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

func (s *AppService) ListTransactions(ctx context.Context, userID int64, limit int) ([]model.TransactionSummary, error) {
	if limit <= 0 {
		limit = 50
	}
	items, err := s.store.ListTransactions(ctx, userID, limit)
	if err != nil {
		return nil, apperror.Internal("failed to load transactions", err)
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
	return items, nil
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}
