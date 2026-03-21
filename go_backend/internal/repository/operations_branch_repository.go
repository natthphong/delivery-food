package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type BranchCreateParams struct {
	CompanyID             int64
	Slug                  string
	Name                  string
	Description           *string
	ImageURL              *string
	AddressLine           *string
	Lat                   *float64
	Lng                   *float64
	IsForceClosed         bool
	AcceptingOrders       bool
	SupportsPickup        bool
	SupportsRiderDelivery bool
	RiderDeliveryFee      float64
	OperationalNote       *string
}

type BranchOperationsUpdateParams struct {
	Name                  *string
	IsForceClosed         *bool
	AcceptingOrders       *bool
	SupportsPickup        *bool
	SupportsRiderDelivery *bool
	RiderDeliveryFee      *float64
	OperationalNote       *string
	ClearOperationalNote  bool
}

type BranchProductOperationsUpdateParams struct {
	IsEnabled             *bool
	IsTemporarilyClosed   *bool
	StockQty              *int
	ReorderLevel          *int
	AvailabilityNote      *string
	ClearAvailabilityNote bool
	PriceOverride         *float64
	ClearPriceOverride    bool
}

type BranchProductAddOnOperationsUpdateParams struct {
	IsEnabled             *bool
	IsTemporarilyClosed   *bool
	AvailabilityNote      *string
	ClearAvailabilityNote bool
	PriceOverride         *float64
	ClearPriceOverride    bool
}

func (s *Store) GetDefaultCompanyID(ctx context.Context) (int64, error) {
	var companyID int64
	err := s.Pool.QueryRow(ctx, `SELECT id FROM companies ORDER BY id LIMIT 1`).Scan(&companyID)
	return companyID, err
}

func (s *Store) ListBranchSummaries(ctx context.Context, branchIDs []int64) ([]model.BranchSummary, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			b.id,
			b.company_id,
			b.name,
			b.slug,
			b.description,
			b.image_url,
			b.address_line,
			b.lat,
			b.lng,
			b.is_force_closed,
			b.accepting_orders,
			b.supports_pickup,
			b.supports_rider_delivery,
			b.rider_delivery_fee::double precision,
			b.operational_note
		FROM branches b
		WHERE COALESCE(array_length($1::bigint[], 1), 0) = 0 OR b.id = ANY($1)
		ORDER BY b.name, b.id
	`, branchIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.BranchSummary, 0)
	for rows.Next() {
		var (
			description     sql.NullString
			imageURL        sql.NullString
			addressLine     sql.NullString
			lat             sql.NullFloat64
			lng             sql.NullFloat64
			operationalNote sql.NullString
			item            model.BranchSummary
		)
		if err := rows.Scan(
			&item.ID,
			&item.CompanyID,
			&item.Name,
			&item.Slug,
			&description,
			&imageURL,
			&addressLine,
			&lat,
			&lng,
			&item.IsForceClosed,
			&item.AcceptingOrders,
			&item.SupportsPickup,
			&item.SupportsRiderDelivery,
			&item.RiderDeliveryFee,
			&operationalNote,
		); err != nil {
			return nil, err
		}
		item.Description = nullString(description)
		item.ImageURL = nullString(imageURL)
		item.AddressLine = nullString(addressLine)
		item.Lat = nullFloat(lat)
		item.Lng = nullFloat(lng)
		item.OperationalNote = nullString(operationalNote)
		item.IsOpen = !item.IsForceClosed && item.AcceptingOrders
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListAdminBranchProducts(ctx context.Context, branchID int64) ([]model.AdminBranchProduct, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			bp.branch_id,
			p.id,
			p.name,
			p.image_url,
			COALESCE(bp.price_override, p.base_price)::double precision,
			p.base_price::double precision,
			bp.price_override::double precision,
			bp.stock_qty,
			bp.is_enabled,
			bp.is_temporarily_closed,
			bp.availability_note,
			bp.reorder_level,
			COALESCE((
				SELECT json_agg(
					json_build_object(
						'id', c.id,
						'name', c.name
					)
					ORDER BY c.sort_order, c.name, c.id
				)
				FROM product_categories pc
				JOIN categories c ON c.id = pc.category_id
				WHERE pc.product_id = p.id
			), '[]'::json),
			CASE
				WHEN bp.stock_qty IS NULL OR bp.reorder_level IS NULL THEN FALSE
				ELSE bp.stock_qty <= bp.reorder_level
			END AS is_low_stock
		FROM branch_products bp
		JOIN products p ON p.id = bp.product_id
		WHERE bp.branch_id = $1
		ORDER BY bp.sort_order, p.name, p.id
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.AdminBranchProduct, 0)
	for rows.Next() {
		var (
			imageURL         sql.NullString
			priceOverride    sql.NullFloat64
			stockQty         sql.NullInt32
			availabilityNote sql.NullString
			reorderLevel     sql.NullInt32
			categoriesJSON   []byte
			item             model.AdminBranchProduct
		)
		if err := rows.Scan(
			&item.BranchID,
			&item.ProductID,
			&item.ProductName,
			&imageURL,
			&item.Price,
			&item.BasePrice,
			&priceOverride,
			&stockQty,
			&item.IsEnabled,
			&item.IsTemporarilyClosed,
			&availabilityNote,
			&reorderLevel,
			&categoriesJSON,
			&item.IsLowStock,
		); err != nil {
			return nil, err
		}
		item.ImageURL = nullString(imageURL)
		item.PriceOverride = nullFloat(priceOverride)
		item.StockQty = nullInt(stockQty)
		item.AvailabilityNote = nullString(availabilityNote)
		item.ReorderLevel = nullInt(reorderLevel)
		if len(categoriesJSON) > 0 {
			if err := json.Unmarshal(categoriesJSON, &item.Categories); err != nil {
				return nil, err
			}
		}
		item.AddOns = make([]model.AdminBranchProductAddOn, 0)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return items, nil
	}

	productIDs := make([]int64, 0, len(items))
	indexByProductID := make(map[int64]int, len(items))
	for index := range items {
		productIDs = append(productIDs, items[index].ProductID)
		indexByProductID[items[index].ProductID] = index
	}

	addOnRows, err := s.Pool.Query(ctx, `
		SELECT
			pa.product_id,
			$1::bigint AS branch_id,
			pa.id,
			pa.group_name,
			pa.name,
			COALESCE(bpa.price_override, pa.price)::double precision,
			pa.price::double precision,
			bpa.price_override::double precision,
			COALESCE(bpa.is_enabled, TRUE),
			COALESCE(bpa.is_temporarily_closed, FALSE),
			bpa.availability_note,
			pa.is_required,
			pa.sort_order
		FROM product_add_ons pa
		LEFT JOIN branch_product_add_ons bpa
			ON bpa.branch_id = $1
			AND bpa.product_add_on_id = pa.id
		WHERE pa.product_id = ANY($2)
		ORDER BY pa.product_id, pa.group_name, pa.sort_order, pa.id
	`, branchID, productIDs)
	if err != nil {
		return nil, err
	}
	defer addOnRows.Close()

	for addOnRows.Next() {
		var (
			productID        int64
			priceOverride    sql.NullFloat64
			availabilityNote sql.NullString
			addOn            model.AdminBranchProductAddOn
		)
		if err := addOnRows.Scan(
			&productID,
			&addOn.BranchID,
			&addOn.AddOnID,
			&addOn.GroupName,
			&addOn.Name,
			&addOn.Price,
			&addOn.BasePrice,
			&priceOverride,
			&addOn.IsEnabled,
			&addOn.IsTemporarilyClosed,
			&availabilityNote,
			&addOn.IsRequired,
			&addOn.SortOrder,
		); err != nil {
			return nil, err
		}
		index, ok := indexByProductID[productID]
		if !ok {
			continue
		}
		addOn.ProductID = productID
		addOn.PriceOverride = nullFloat(priceOverride)
		addOn.AvailabilityNote = nullString(availabilityNote)
		items[index].AddOns = append(items[index].AddOns, addOn)
	}
	return items, addOnRows.Err()
}

func (s *Store) CreateBranch(ctx context.Context, tx DBTX, params BranchCreateParams) (int64, error) {
	var (
		description     sql.NullString
		imageURL        sql.NullString
		addressLine     sql.NullString
		lat             sql.NullFloat64
		lng             sql.NullFloat64
		operationalNote sql.NullString
		branchID        int64
	)
	if params.Description != nil {
		description = sql.NullString{String: strings.TrimSpace(*params.Description), Valid: strings.TrimSpace(*params.Description) != ""}
	}
	if params.ImageURL != nil {
		imageURL = sql.NullString{String: strings.TrimSpace(*params.ImageURL), Valid: strings.TrimSpace(*params.ImageURL) != ""}
	}
	if params.AddressLine != nil {
		addressLine = sql.NullString{String: strings.TrimSpace(*params.AddressLine), Valid: strings.TrimSpace(*params.AddressLine) != ""}
	}
	if params.Lat != nil {
		lat = sql.NullFloat64{Float64: *params.Lat, Valid: true}
	}
	if params.Lng != nil {
		lng = sql.NullFloat64{Float64: *params.Lng, Valid: true}
	}
	if params.OperationalNote != nil {
		operationalNote = sql.NullString{String: strings.TrimSpace(*params.OperationalNote), Valid: strings.TrimSpace(*params.OperationalNote) != ""}
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO branches (
			company_id,
			slug,
			name,
			description,
			image_url,
			address_line,
			lat,
			lng,
			is_force_closed,
			accepting_orders,
			supports_pickup,
			supports_rider_delivery,
			rider_delivery_fee,
			operational_note
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`, params.CompanyID, strings.TrimSpace(params.Slug), strings.TrimSpace(params.Name), description, imageURL, addressLine, lat, lng, params.IsForceClosed, params.AcceptingOrders, params.SupportsPickup, params.SupportsRiderDelivery, params.RiderDeliveryFee, operationalNote).Scan(&branchID)
	return branchID, err
}

func (s *Store) UpdateBranchOperations(ctx context.Context, tx DBTX, branchID int64, params BranchOperationsUpdateParams) error {
	var (
		name            sql.NullString
		operationalNote sql.NullString
		riderFee        sql.NullFloat64
	)
	if params.Name != nil {
		name = sql.NullString{String: strings.TrimSpace(*params.Name), Valid: strings.TrimSpace(*params.Name) != ""}
	}
	if params.OperationalNote != nil {
		operationalNote = sql.NullString{String: strings.TrimSpace(*params.OperationalNote), Valid: strings.TrimSpace(*params.OperationalNote) != ""}
	}
	if params.RiderDeliveryFee != nil {
		riderFee = sql.NullFloat64{Float64: *params.RiderDeliveryFee, Valid: true}
	}
	_, err := tx.Exec(ctx, `
		UPDATE branches
		SET
			name = COALESCE($2, name),
			is_force_closed = COALESCE($3, is_force_closed),
			accepting_orders = COALESCE($4, accepting_orders),
			supports_pickup = COALESCE($5, supports_pickup),
			supports_rider_delivery = COALESCE($6, supports_rider_delivery),
			rider_delivery_fee = COALESCE($7, rider_delivery_fee),
			operational_note = CASE
				WHEN $9 THEN NULL
				WHEN $8 IS NOT NULL THEN $8
				ELSE operational_note
			END,
			updated_at = NOW()
		WHERE id = $1
	`, branchID, name, params.IsForceClosed, params.AcceptingOrders, params.SupportsPickup, params.SupportsRiderDelivery, riderFee, operationalNote, params.ClearOperationalNote)
	return err
}

func (s *Store) UpdateBranchProductOperations(ctx context.Context, tx DBTX, branchID, productID int64, params BranchProductOperationsUpdateParams) error {
	var (
		priceOverride    sql.NullFloat64
		stockQty         sql.NullInt32
		reorderLevel     sql.NullInt32
		availabilityNote sql.NullString
	)
	if params.PriceOverride != nil {
		priceOverride = sql.NullFloat64{Float64: *params.PriceOverride, Valid: true}
	}
	if params.StockQty != nil {
		stockQty = sql.NullInt32{Int32: int32(*params.StockQty), Valid: true}
	}
	if params.ReorderLevel != nil {
		reorderLevel = sql.NullInt32{Int32: int32(*params.ReorderLevel), Valid: true}
	}
	if params.AvailabilityNote != nil {
		availabilityNote = sql.NullString{String: strings.TrimSpace(*params.AvailabilityNote), Valid: strings.TrimSpace(*params.AvailabilityNote) != ""}
	}
	_, err := tx.Exec(ctx, `
		UPDATE branch_products
		SET
			is_enabled = COALESCE($3, is_enabled),
			is_temporarily_closed = COALESCE($4, is_temporarily_closed),
			stock_qty = COALESCE($5, stock_qty),
			reorder_level = COALESCE($6, reorder_level),
			availability_note = CASE
				WHEN $8 THEN NULL
				WHEN $7 IS NOT NULL THEN $7
				ELSE availability_note
			END,
			price_override = CASE
				WHEN $10 THEN NULL
				WHEN $9 IS NOT NULL THEN $9
				ELSE price_override
			END,
			updated_at = NOW()
		WHERE branch_id = $1 AND product_id = $2
	`, branchID, productID, params.IsEnabled, params.IsTemporarilyClosed, stockQty, reorderLevel, availabilityNote, params.ClearAvailabilityNote, priceOverride, params.ClearPriceOverride)
	return err
}

func (s *Store) UpdateBranchProductAddOnOperations(ctx context.Context, tx DBTX, branchID, productID, addOnID int64, params BranchProductAddOnOperationsUpdateParams) error {
	var (
		priceOverride    sql.NullFloat64
		availabilityNote sql.NullString
	)
	if params.PriceOverride != nil {
		priceOverride = sql.NullFloat64{Float64: *params.PriceOverride, Valid: true}
	}
	if params.AvailabilityNote != nil {
		availabilityNote = sql.NullString{String: strings.TrimSpace(*params.AvailabilityNote), Valid: strings.TrimSpace(*params.AvailabilityNote) != ""}
	}
	tag, err := tx.Exec(ctx, `
		WITH target AS (
			SELECT 1
			FROM product_add_ons pa
			JOIN branch_products bp
				ON bp.product_id = pa.product_id
				AND bp.branch_id = $1
			WHERE pa.id = $2
				AND pa.product_id = $3
		),
		existing AS (
			SELECT
				is_enabled,
				is_temporarily_closed,
				price_override,
				availability_note
			FROM branch_product_add_ons
			WHERE branch_id = $1
				AND product_add_on_id = $2
		)
		INSERT INTO branch_product_add_ons (
			branch_id,
			product_add_on_id,
			is_enabled,
			is_temporarily_closed,
			price_override,
			availability_note
		)
		SELECT
			$1,
			$2,
			COALESCE($4, existing.is_enabled, TRUE),
			COALESCE($5, existing.is_temporarily_closed, FALSE),
			CASE
				WHEN $8 THEN NULL
				WHEN $6 IS NOT NULL THEN $6
				ELSE existing.price_override
			END,
			CASE
				WHEN $9 THEN NULL
				WHEN $7 IS NOT NULL THEN $7
				ELSE existing.availability_note
			END
		FROM target
		LEFT JOIN existing ON TRUE
		)
		ON CONFLICT (branch_id, product_add_on_id)
		DO UPDATE SET
			is_enabled = COALESCE(EXCLUDED.is_enabled, branch_product_add_ons.is_enabled),
			is_temporarily_closed = COALESCE(EXCLUDED.is_temporarily_closed, branch_product_add_ons.is_temporarily_closed),
			price_override = CASE
				WHEN $8 THEN NULL
				WHEN $6 IS NOT NULL THEN $6
				ELSE branch_product_add_ons.price_override
			END,
			availability_note = CASE
				WHEN $9 THEN NULL
				WHEN $7 IS NOT NULL THEN $7
				ELSE branch_product_add_ons.availability_note
			END,
			updated_at = NOW()
	`, branchID, addOnID, productID, params.IsEnabled, params.IsTemporarilyClosed, priceOverride, availabilityNote, params.ClearPriceOverride, params.ClearAvailabilityNote)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) CopyBranchProducts(ctx context.Context, tx DBTX, sourceBranchID, targetBranchID int64, productIDs []int64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO branch_products (
			branch_id,
			product_id,
			is_enabled,
			stock_qty,
			price_override,
			is_recommended,
			sort_order,
			is_temporarily_closed,
			availability_note,
			reorder_level
		)
		SELECT
			$2,
			bp.product_id,
			bp.is_enabled,
			bp.stock_qty,
			bp.price_override,
			bp.is_recommended,
			bp.sort_order,
			FALSE,
			NULL,
			bp.reorder_level
		FROM branch_products bp
		WHERE bp.branch_id = $1
			AND (COALESCE(array_length($3::bigint[], 1), 0) = 0 OR bp.product_id = ANY($3))
		ON CONFLICT (branch_id, product_id)
		DO UPDATE SET
			is_enabled = EXCLUDED.is_enabled,
			stock_qty = EXCLUDED.stock_qty,
			price_override = EXCLUDED.price_override,
			is_recommended = EXCLUDED.is_recommended,
			sort_order = EXCLUDED.sort_order,
			is_temporarily_closed = EXCLUDED.is_temporarily_closed,
			availability_note = EXCLUDED.availability_note,
			reorder_level = EXCLUDED.reorder_level,
			updated_at = NOW()
	`, sourceBranchID, targetBranchID, productIDs)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO branch_product_add_ons (
			branch_id,
			product_add_on_id,
			is_enabled,
			is_temporarily_closed,
			price_override,
			availability_note
		)
		SELECT
			$2,
			bpa.product_add_on_id,
			bpa.is_enabled,
			bpa.is_temporarily_closed,
			bpa.price_override,
			bpa.availability_note
		FROM branch_product_add_ons bpa
		JOIN product_add_ons pa ON pa.id = bpa.product_add_on_id
		WHERE bpa.branch_id = $1
			AND (
				COALESCE(array_length($3::bigint[], 1), 0) = 0
				OR pa.product_id = ANY($3)
			)
		ON CONFLICT (branch_id, product_add_on_id)
		DO UPDATE SET
			is_enabled = EXCLUDED.is_enabled,
			is_temporarily_closed = EXCLUDED.is_temporarily_closed,
			price_override = EXCLUDED.price_override,
			availability_note = EXCLUDED.availability_note,
			updated_at = NOW()
	`, sourceBranchID, targetBranchID, productIDs)
	return err
}

func (s *Store) AdjustBranchStock(ctx context.Context, tx DBTX, branchID, productID int64, deltaQty int, reason string, note *string, actorEmployeeID *int64) error {
	var (
		currentStock sql.NullInt32
		noteValue    sql.NullString
		actorID      sql.NullInt64
	)
	if note != nil {
		noteValue = sql.NullString{String: strings.TrimSpace(*note), Valid: strings.TrimSpace(*note) != ""}
	}
	if actorEmployeeID != nil {
		actorID = sql.NullInt64{Int64: *actorEmployeeID, Valid: true}
	}
	if err := tx.QueryRow(ctx, `
		SELECT stock_qty
		FROM branch_products
		WHERE branch_id = $1 AND product_id = $2
		FOR UPDATE
	`, branchID, productID).Scan(&currentStock); err != nil {
		return err
	}
	nextStock := deltaQty
	if currentStock.Valid {
		nextStock += int(currentStock.Int32)
	}
	if nextStock < 0 {
		return sql.ErrNoRows
	}
	if _, err := tx.Exec(ctx, `
		UPDATE branch_products
		SET stock_qty = $3, updated_at = NOW()
		WHERE branch_id = $1 AND product_id = $2
	`, branchID, productID, nextStock); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO branch_stock_movements (branch_id, product_id, delta_qty, reason, note, created_by_employee_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, branchID, productID, deltaQty, strings.TrimSpace(reason), noteValue, actorID)
	return err
}
