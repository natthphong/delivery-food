package service

import (
	"context"
	"sort"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type CartService struct {
	store *repository.Store
}

func NewCartService(store *repository.Store) *CartService {
	return &CartService{store: store}
}

func (s *CartService) GetCart(ctx context.Context, userID int64) (model.Cart, error) {
	cart, err := s.store.GetCart(ctx, userID)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to load cart", err)
	}
	return cart, nil
}

func (s *CartService) AddItem(ctx context.Context, userID int64, request dto.AddCartItemRequest) (model.Cart, error) {
	if request.BranchID <= 0 || request.ProductID <= 0 {
		return model.Cart{}, apperror.BadRequest("branchId and productId are required")
	}
	if request.Quantity <= 0 {
		return model.Cart{}, apperror.BadRequest("quantity must be greater than 0")
	}

	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return model.Cart{}, err
	}
	maxQty := configInt(configs, "MAX_QTY_PER_ITEM", 10)
	maxItems := configInt(configs, "MAX_CART_ITEMS", 100)

	product, err := s.store.GetSellableProduct(ctx, request.BranchID, request.ProductID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.Cart{}, apperror.NotFound("product is not available in this branch")
		}
		return model.Cart{}, apperror.Internal("failed to load product", err)
	}

	addOns, err := s.store.GetProductAddOns(ctx, request.BranchID, request.ProductID, request.AddOnIDs)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to load add-ons", err)
	}
	if len(addOns) != len(uniqueIDs(request.AddOnIDs)) {
		return model.Cart{}, apperror.BadRequest("one or more add-ons are invalid")
	}

	signature := repository.BuildAddOnSignature(addOns)
	cart, err := s.store.GetCart(ctx, userID)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to inspect cart", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to update cart", err)
	}
	defer tx.Rollback(ctx)

	cartID, err := s.store.GetOrCreateCartID(ctx, tx, userID)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to create cart", err)
	}

	variant, err := s.store.GetCartVariant(ctx, tx, cartID, request.BranchID, request.ProductID, signature)
	switch {
	case err == nil:
		nextQuantity := variant.Quantity + request.Quantity
		if nextQuantity > maxQty {
			return model.Cart{}, apperror.Conflict("cart item quantity exceeds the configured maximum")
		}
		if product.StockQty != nil && nextQuantity > *product.StockQty {
			return model.Cart{}, apperror.Conflict("requested quantity exceeds stock")
		}
		if err := s.store.UpdateCartItemQuantity(ctx, tx, cartID, variant.ID, nextQuantity); err != nil {
			return model.Cart{}, apperror.Internal("failed to update cart item", err)
		}
	case repository.IsNotFound(err):
		if request.Quantity > maxQty {
			return model.Cart{}, apperror.Conflict("cart item quantity exceeds the configured maximum")
		}
		if product.StockQty != nil && request.Quantity > *product.StockQty {
			return model.Cart{}, apperror.Conflict("requested quantity exceeds stock")
		}
		if cart.TotalItems >= maxItems {
			return model.Cart{}, apperror.Conflict("cart line limit reached")
		}
		itemID, err := s.store.InsertCartItem(ctx, tx, cartID, request.BranchID, request.ProductID, request.Quantity, product.UnitPrice, signature)
		if err != nil {
			return model.Cart{}, apperror.Internal("failed to insert cart item", err)
		}
		if err := s.store.ReplaceCartItemAddOns(ctx, tx, itemID, addOns); err != nil {
			return model.Cart{}, apperror.Internal("failed to persist cart add-ons", err)
		}
	default:
		return model.Cart{}, apperror.Internal("failed to inspect cart item", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return model.Cart{}, apperror.Internal("failed to commit cart changes", err)
	}
	return s.GetCart(ctx, userID)
}

func (s *CartService) UpdateItem(ctx context.Context, userID int64, itemID int64, request dto.UpdateCartItemRequest) (model.Cart, error) {
	if request.Quantity <= 0 {
		return s.RemoveItem(ctx, userID, itemID)
	}
	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return model.Cart{}, err
	}
	maxQty := configInt(configs, "MAX_QTY_PER_ITEM", 10)
	if request.Quantity > maxQty {
		return model.Cart{}, apperror.Conflict("cart item quantity exceeds the configured maximum")
	}

	items, cartID, err := s.store.GetCartItemsByIDs(ctx, userID, []int64{itemID})
	if err != nil {
		if repository.IsNotFound(err) {
			return model.Cart{}, apperror.NotFound("cart item not found")
		}
		return model.Cart{}, apperror.Internal("failed to load cart item", err)
	}

	item := items[0]
	product, err := s.store.GetSellableProduct(ctx, item.BranchID, item.ProductID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.Cart{}, apperror.NotFound("product is no longer available")
		}
		return model.Cart{}, apperror.Internal("failed to load product", err)
	}
	if product.StockQty != nil && request.Quantity > *product.StockQty {
		return model.Cart{}, apperror.Conflict("requested quantity exceeds stock")
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to update cart", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.UpdateCartItemQuantity(ctx, tx, cartID, itemID, request.Quantity); err != nil {
		return model.Cart{}, apperror.Internal("failed to update cart item", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Cart{}, apperror.Internal("failed to commit cart changes", err)
	}
	return s.GetCart(ctx, userID)
}

func (s *CartService) RemoveItem(ctx context.Context, userID int64, itemID int64) (model.Cart, error) {
	_, cartID, err := s.store.GetCartItemsByIDs(ctx, userID, []int64{itemID})
	if err != nil {
		if repository.IsNotFound(err) {
			return model.Cart{}, apperror.NotFound("cart item not found")
		}
		return model.Cart{}, apperror.Internal("failed to load cart item", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to update cart", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.DeleteCartItem(ctx, tx, cartID, itemID); err != nil {
		return model.Cart{}, apperror.Internal("failed to delete cart item", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Cart{}, apperror.Internal("failed to commit cart changes", err)
	}
	return s.GetCart(ctx, userID)
}

func (s *CartService) ClearBranch(ctx context.Context, userID int64, branchID int64) (model.Cart, error) {
	if branchID <= 0 {
		return model.Cart{}, apperror.BadRequest("branchId is required")
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to update cart", err)
	}
	defer tx.Rollback(ctx)
	cartID, err := s.store.GetOrCreateCartID(ctx, tx, userID)
	if err != nil {
		return model.Cart{}, apperror.Internal("failed to create cart", err)
	}
	if err := s.store.DeleteCartItemsByBranch(ctx, tx, cartID, branchID); err != nil {
		return model.Cart{}, apperror.Internal("failed to clear branch cart", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Cart{}, apperror.Internal("failed to commit cart changes", err)
	}
	return s.GetCart(ctx, userID)
}

func uniqueIDs(values []int64) []int64 {
	set := make(map[int64]struct{}, len(values))
	for _, value := range values {
		set[value] = struct{}{}
	}
	result := make([]int64, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}
