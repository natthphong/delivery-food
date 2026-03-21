package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type SellableProduct struct {
	BranchID               int64
	CompanyID              int64
	BranchName             string
	BranchImage            *string
	AcceptingOrders        bool
	SupportsPickup         bool
	SupportsRiderDelivery  bool
	RiderDeliveryFee       float64
	OperationalNote        *string
	ProductID              int64
	ProductName            string
	ProductImage           *string
	UnitPrice              float64
	StockQty               *int
	IsTemporarilyClosed    bool
	AvailabilityNote       *string
}

type CartVariantRecord struct {
	ID       int64
	Quantity int
}

func (s *Store) GetOrCreateCartID(ctx context.Context, tx DBTX, userID int64) (int64, error) {
	var cartID int64
	err := tx.QueryRow(ctx, `
		INSERT INTO carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id)
		DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, userID).Scan(&cartID)
	return cartID, err
}

func (s *Store) GetSellableProduct(ctx context.Context, branchID, productID int64) (SellableProduct, error) {
	var (
		branchImage      sql.NullString
		productImage     sql.NullString
		stockQty         sql.NullInt32
		operationalNote  sql.NullString
		availabilityNote sql.NullString
		product          SellableProduct
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT
			b.id,
			b.company_id,
			b.name,
			b.image_url,
			b.accepting_orders,
			b.supports_pickup,
			b.supports_rider_delivery,
			b.rider_delivery_fee::double precision,
			b.operational_note,
			p.id,
			p.name,
			p.image_url,
			COALESCE(bp.price_override, p.base_price)::double precision,
			bp.stock_qty,
			bp.is_temporarily_closed,
			bp.availability_note
		FROM branch_products bp
		JOIN branches b ON b.id = bp.branch_id
		JOIN products p ON p.id = bp.product_id
		WHERE bp.branch_id = $1
			AND bp.product_id = $2
			AND bp.is_enabled = TRUE
			AND bp.is_temporarily_closed = FALSE
			AND b.accepting_orders = TRUE
			AND p.is_active = TRUE
	`, branchID, productID).Scan(
		&product.BranchID,
		&product.CompanyID,
		&product.BranchName,
		&branchImage,
		&product.AcceptingOrders,
		&product.SupportsPickup,
		&product.SupportsRiderDelivery,
		&product.RiderDeliveryFee,
		&operationalNote,
		&product.ProductID,
		&product.ProductName,
		&productImage,
		&product.UnitPrice,
		&stockQty,
		&product.IsTemporarilyClosed,
		&availabilityNote,
	)
	if err != nil {
		return SellableProduct{}, err
	}
	product.BranchImage = nullString(branchImage)
	product.ProductImage = nullString(productImage)
	product.StockQty = nullInt(stockQty)
	product.OperationalNote = nullString(operationalNote)
	product.AvailabilityNote = nullString(availabilityNote)
	return product, nil
}

func (s *Store) GetProductAddOns(ctx context.Context, productID int64, addOnIDs []int64) ([]model.ProductAddOn, error) {
	if len(addOnIDs) == 0 {
		return []model.ProductAddOn{}, nil
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, group_name, name, price::double precision, is_required, sort_order
		FROM product_add_ons
		WHERE product_id = $1 AND id = ANY($2)
		ORDER BY sort_order, id
	`, productID, addOnIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	addOns := make([]model.ProductAddOn, 0, len(addOnIDs))
	for rows.Next() {
		var item model.ProductAddOn
		if err := rows.Scan(
			&item.ID,
			&item.GroupName,
			&item.Name,
			&item.Price,
			&item.IsRequired,
			&item.SortOrder,
		); err != nil {
			return nil, err
		}
		addOns = append(addOns, item)
	}
	return addOns, rows.Err()
}

func (s *Store) GetCartVariant(
	ctx context.Context,
	tx DBTX,
	cartID int64,
	branchID int64,
	productID int64,
	signature string,
) (CartVariantRecord, error) {
	var item CartVariantRecord
	err := tx.QueryRow(ctx, `
		SELECT id, quantity
		FROM cart_items
		WHERE cart_id = $1
			AND branch_id = $2
			AND product_id = $3
			AND add_on_signature = $4
	`, cartID, branchID, productID, signature).Scan(&item.ID, &item.Quantity)
	if err != nil {
		return CartVariantRecord{}, err
	}
	return item, nil
}

func (s *Store) InsertCartItem(
	ctx context.Context,
	tx DBTX,
	cartID int64,
	branchID int64,
	productID int64,
	quantity int,
	unitPrice float64,
	signature string,
) (int64, error) {
	var itemID int64
	err := tx.QueryRow(ctx, `
		INSERT INTO cart_items (cart_id, branch_id, product_id, quantity, unit_price, add_on_signature)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, cartID, branchID, productID, quantity, unitPrice, signature).Scan(&itemID)
	if err != nil {
		return 0, err
	}
	return itemID, s.touchCart(ctx, tx, cartID)
}

func (s *Store) UpdateCartItemQuantity(ctx context.Context, tx DBTX, cartID int64, itemID int64, quantity int) error {
	if _, err := tx.Exec(ctx, `
		UPDATE cart_items
		SET quantity = $3,
			updated_at = NOW()
		WHERE id = $2 AND cart_id = $1
	`, cartID, itemID, quantity); err != nil {
		return err
	}
	return s.touchCart(ctx, tx, cartID)
}

func (s *Store) ReplaceCartItemAddOns(ctx context.Context, tx DBTX, itemID int64, addOns []model.ProductAddOn) error {
	if _, err := tx.Exec(ctx, `DELETE FROM cart_item_add_ons WHERE cart_item_id = $1`, itemID); err != nil {
		return err
	}
	for _, addOn := range addOns {
		if _, err := tx.Exec(ctx, `
			INSERT INTO cart_item_add_ons (cart_item_id, product_add_on_id, name, price)
			VALUES ($1, $2, $3, $4)
		`, itemID, addOn.ID, addOn.Name, addOn.Price); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteCartItem(ctx context.Context, tx DBTX, cartID int64, itemID int64) error {
	if _, err := tx.Exec(ctx, `
		DELETE FROM cart_items
		WHERE cart_id = $1 AND id = $2
	`, cartID, itemID); err != nil {
		return err
	}
	return s.touchCart(ctx, tx, cartID)
}

func (s *Store) DeleteCartItemsByIDs(ctx context.Context, tx DBTX, cartID int64, itemIDs []int64) error {
	if len(itemIDs) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM cart_items
		WHERE cart_id = $1 AND id = ANY($2)
	`, cartID, itemIDs); err != nil {
		return err
	}
	return s.touchCart(ctx, tx, cartID)
}

func (s *Store) DeleteCartItemsByBranch(ctx context.Context, tx DBTX, cartID int64, branchID int64) error {
	if _, err := tx.Exec(ctx, `
		DELETE FROM cart_items
		WHERE cart_id = $1 AND branch_id = $2
	`, cartID, branchID); err != nil {
		return err
	}
	return s.touchCart(ctx, tx, cartID)
}

func (s *Store) GetCart(ctx context.Context, userID int64) (model.Cart, error) {
	cart := model.Cart{
		Groups:       []model.CartBranchGroup{},
		LastSyncedAt: time.Now(),
	}

	var (
		cartID    int64
		updatedAt time.Time
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT id, updated_at
		FROM carts
		WHERE user_id = $1
	`, userID).Scan(&cartID, &updatedAt)
	if err != nil {
		if IsNotFound(err) {
			return cart, nil
		}
		return model.Cart{}, err
	}
	cart.LastSyncedAt = updatedAt

	rows, err := s.Pool.Query(ctx, `
		SELECT
			ci.id,
			ci.branch_id,
			b.company_id,
			b.name,
			b.image_url,
			ci.product_id,
			p.name,
			p.image_url,
			ci.quantity,
			ci.unit_price::double precision,
			bp.stock_qty,
			ci.add_on_signature,
			ci.created_at,
			ci.updated_at
		FROM cart_items ci
		JOIN branches b ON b.id = ci.branch_id
		JOIN products p ON p.id = ci.product_id
		LEFT JOIN branch_products bp ON bp.branch_id = ci.branch_id AND bp.product_id = ci.product_id
		WHERE ci.cart_id = $1
		ORDER BY ci.created_at, ci.id
	`, cartID)
	if err != nil {
		return model.Cart{}, err
	}
	defer rows.Close()

	type groupIndex struct {
		group *model.CartBranchGroup
		index map[int64]int
	}
	groupMap := make(map[int64]*groupIndex)
	itemIDs := make([]int64, 0)

	for rows.Next() {
		var (
			branchImage sql.NullString
			productImage sql.NullString
			stockQty    sql.NullInt32
			item        model.CartItem
			companyID   int64
			branchName  string
		)
		if err := rows.Scan(
			&item.ID,
			&item.BranchID,
			&companyID,
			&branchName,
			&branchImage,
			&item.ProductID,
			&item.ProductName,
			&productImage,
			&item.Quantity,
			&item.UnitPrice,
			&stockQty,
			&item.VariantKey,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return model.Cart{}, err
		}
		item.ImageURL = nullString(productImage)
		item.StockQty = nullInt(stockQty)
		itemIDs = append(itemIDs, item.ID)

		groupState, ok := groupMap[item.BranchID]
		if !ok {
			cart.Groups = append(cart.Groups, model.CartBranchGroup{
				BranchID:    item.BranchID,
				CompanyID:   companyID,
				BranchName:  branchName,
				BranchImage: nullString(branchImage),
				Items:       []model.CartItem{},
			})
			groupState = &groupIndex{
				group: &cart.Groups[len(cart.Groups)-1],
				index: make(map[int64]int),
			}
			groupMap[item.BranchID] = groupState
		}
		itemIndex := len(groupState.group.Items)
		groupState.group.Items = append(groupState.group.Items, item)
		groupState.index[item.ID] = itemIndex
	}
	if err := rows.Err(); err != nil {
		return model.Cart{}, err
	}

	if len(itemIDs) > 0 {
		addOnRows, err := s.Pool.Query(ctx, `
			SELECT
				cia.cart_item_id,
				cia.product_add_on_id,
				cia.name,
				cia.price::double precision
			FROM cart_item_add_ons cia
			WHERE cia.cart_item_id = ANY($1)
			ORDER BY cia.id
		`, itemIDs)
		if err != nil {
			return model.Cart{}, err
		}
		defer addOnRows.Close()

		itemBranchMap := make(map[int64]int64)
		for _, group := range cart.Groups {
			for _, item := range group.Items {
				itemBranchMap[item.ID] = group.BranchID
			}
		}

		for addOnRows.Next() {
			var (
				itemID int64
				addOnID sql.NullInt64
				addOn  model.CartAddOn
			)
			if err := addOnRows.Scan(&itemID, &addOnID, &addOn.Name, &addOn.Price); err != nil {
				return model.Cart{}, err
			}
			addOn.ID = nullInt64(addOnID)
			branchID := itemBranchMap[itemID]
			groupState := groupMap[branchID]
			index := groupState.index[itemID]
			groupState.group.Items[index].AddOns = append(groupState.group.Items[index].AddOns, addOn)
		}
		if err := addOnRows.Err(); err != nil {
			return model.Cart{}, err
		}
	}

	for groupIndex := range cart.Groups {
		group := &cart.Groups[groupIndex]
		for itemIndex := range group.Items {
			item := &group.Items[itemIndex]
			item.LineTotal = item.UnitPrice * float64(item.Quantity)
			for _, addOn := range item.AddOns {
				item.LineTotal += addOn.Price * float64(item.Quantity)
			}
			group.SubTotal += item.LineTotal
			cart.TotalQuantity += item.Quantity
			cart.TotalItems++
		}
		cart.TotalAmount += group.SubTotal
	}

	sort.Slice(cart.Groups, func(i, j int) bool {
		return cart.Groups[i].BranchID < cart.Groups[j].BranchID
	})
	return cart, nil
}

func (s *Store) GetCartItemsByIDs(ctx context.Context, userID int64, itemIDs []int64) ([]model.CartItem, int64, error) {
	if len(itemIDs) == 0 {
		return []model.CartItem{}, 0, nil
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT
			c.id,
			ci.id,
			ci.branch_id,
			ci.product_id,
			p.name,
			p.image_url,
			ci.quantity,
			ci.unit_price::double precision,
			bp.stock_qty,
			ci.add_on_signature,
			ci.created_at,
			ci.updated_at
		FROM carts c
		JOIN cart_items ci ON ci.cart_id = c.id
		JOIN products p ON p.id = ci.product_id
		LEFT JOIN branch_products bp ON bp.branch_id = ci.branch_id AND bp.product_id = ci.product_id
		WHERE c.user_id = $1
			AND ci.id = ANY($2)
		ORDER BY ci.id
	`, userID, itemIDs)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]model.CartItem, 0, len(itemIDs))
	var cartID int64
	for rows.Next() {
		var (
			itemCartID int64
			imageURL   sql.NullString
			stockQty   sql.NullInt32
			item       model.CartItem
		)
		if err := rows.Scan(
			&itemCartID,
			&item.ID,
			&item.BranchID,
			&item.ProductID,
			&item.ProductName,
			&imageURL,
			&item.Quantity,
			&item.UnitPrice,
			&stockQty,
			&item.VariantKey,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		item.ImageURL = nullString(imageURL)
		item.StockQty = nullInt(stockQty)
		cartID = itemCartID
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(items) != len(itemIDs) {
		return nil, 0, pgx.ErrNoRows
	}

	addOnRows, err := s.Pool.Query(ctx, `
		SELECT cart_item_id, product_add_on_id, name, price::double precision
		FROM cart_item_add_ons
		WHERE cart_item_id = ANY($1)
		ORDER BY id
	`, itemIDs)
	if err != nil {
		return nil, 0, err
	}
	defer addOnRows.Close()

	indexByID := make(map[int64]int, len(items))
	for i, item := range items {
		indexByID[item.ID] = i
	}
	for addOnRows.Next() {
		var (
			itemID int64
			addOnID sql.NullInt64
			addOn  model.CartAddOn
		)
		if err := addOnRows.Scan(&itemID, &addOnID, &addOn.Name, &addOn.Price); err != nil {
			return nil, 0, err
		}
		addOn.ID = nullInt64(addOnID)
		index := indexByID[itemID]
		items[index].AddOns = append(items[index].AddOns, addOn)
	}
	if err := addOnRows.Err(); err != nil {
		return nil, 0, err
	}

	for index := range items {
		items[index].LineTotal = items[index].UnitPrice * float64(items[index].Quantity)
		for _, addOn := range items[index].AddOns {
			items[index].LineTotal += addOn.Price * float64(items[index].Quantity)
		}
	}
	return items, cartID, nil
}

func (s *Store) touchCart(ctx context.Context, tx DBTX, cartID int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE carts
		SET updated_at = NOW()
		WHERE id = $1
	`, cartID)
	return err
}

func BuildAddOnSignature(addOns []model.ProductAddOn) string {
	type signatureItem struct {
		ID    int64
		Name  string
		Price float64
	}
	items := make([]signatureItem, 0, len(addOns))
	for _, addOn := range addOns {
		items = append(items, signatureItem{ID: addOn.ID, Name: addOn.Name, Price: addOn.Price})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].ID == items[j].ID {
			return items[i].Name < items[j].Name
		}
		return items[i].ID < items[j].ID
	})
	return fmt.Sprintf("%v", items)
}
