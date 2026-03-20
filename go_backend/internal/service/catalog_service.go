package service

import (
	"context"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type CatalogSearchPayload struct {
	Branches   []model.BranchSearchResult `json:"branches"`
	Categories []model.Category          `json:"categories"`
}

type BranchMenuPayload struct {
	Branch model.BranchSummary `json:"branch"`
	Menu   []model.MenuItem    `json:"menu"`
	Page   int                 `json:"page,omitempty"`
	Size   int                 `json:"size,omitempty"`
	Total  int                 `json:"total,omitempty"`
}

type CatalogService struct {
	store *repository.Store
}

func NewCatalogService(store *repository.Store) *CatalogService {
	return &CatalogService{store: store}
}

func (s *CatalogService) Search(
	ctx context.Context,
	query string,
	categoryID *int64,
	lat *float64,
	lng *float64,
) (CatalogSearchPayload, error) {
	branches, err := s.store.SearchBranches(ctx, query, categoryID, lat, lng)
	if err != nil {
		return CatalogSearchPayload{}, apperror.Internal("failed to search branches", err)
	}
	categories, err := s.store.ListCategories(ctx)
	if err != nil {
		return CatalogSearchPayload{}, apperror.Internal("failed to load categories", err)
	}
	return CatalogSearchPayload{
		Branches:   branches,
		Categories: categories,
	}, nil
}

func (s *CatalogService) BranchMenu(ctx context.Context, branchID int64, query string, page int, size int) (BranchMenuPayload, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 20
	}
	branch, menu, total, err := s.store.GetBranchMenuPage(ctx, branchID, query, page, size, false)
	if err != nil {
		if repository.IsNotFound(err) {
			return BranchMenuPayload{}, apperror.NotFound("branch not found")
		}
		return BranchMenuPayload{}, apperror.Internal("failed to load branch menu", err)
	}
	return BranchMenuPayload{Branch: branch, Menu: menu, Page: page, Size: size, Total: total}, nil
}

func (s *CatalogService) FeaturedMenu(ctx context.Context, branchID int64) (BranchMenuPayload, error) {
	branch, menu, total, err := s.store.GetBranchMenuPage(ctx, branchID, "", 1, 12, true)
	if err != nil {
		if repository.IsNotFound(err) {
			return BranchMenuPayload{}, apperror.NotFound("branch not found")
		}
		return BranchMenuPayload{}, apperror.Internal("failed to load featured menu", err)
	}
	return BranchMenuPayload{Branch: branch, Menu: menu, Page: 1, Size: 12, Total: total}, nil
}

func (s *CatalogService) PaymentMethods(ctx context.Context, companyID int64) ([]model.PaymentMethod, error) {
	if companyID <= 0 {
		return nil, apperror.BadRequest("companyId is required")
	}
	methods, err := s.store.GetPaymentMethods(ctx, companyID)
	if err != nil {
		return nil, apperror.Internal("failed to load payment methods", err)
	}
	return methods, nil
}
