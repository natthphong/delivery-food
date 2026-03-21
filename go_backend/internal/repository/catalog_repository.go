package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type branchSearchRow struct {
	model.BranchSummary
	DistanceKM    *float64
	MatchCount    int
	ProductSample []model.BranchSearchSample
}

func (s *Store) ListCategories(ctx context.Context) ([]model.Category, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, company_id, slug, name, description, sort_order, is_active
		FROM categories
		WHERE is_active = TRUE
		ORDER BY sort_order, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]model.Category, 0)
	for rows.Next() {
		var (
			description sql.NullString
			item        model.Category
		)
		if err := rows.Scan(
			&item.ID,
			&item.CompanyID,
			&item.Slug,
			&item.Name,
			&description,
			&item.SortOrder,
			&item.IsActive,
		); err != nil {
			return nil, err
		}
		item.Description = nullString(description)
		categories = append(categories, item)
	}
	return categories, rows.Err()
}

func (s *Store) SearchBranches(
	ctx context.Context,
	query string,
	categoryID *int64,
	lat *float64,
	lng *float64,
) ([]model.BranchSearchResult, error) {
	searchQuery := strings.TrimSpace(strings.ToLower(query))

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
			b.operational_note,
			COALESCE(hours.hours_json, '[]'::json) AS open_hours,
			CASE
				WHEN $3::double precision IS NULL OR $4::double precision IS NULL OR b.lat IS NULL OR b.lng IS NULL THEN NULL
				ELSE ROUND((
					6371 * ACOS(
						LEAST(1, GREATEST(-1,
							COS(RADIANS($3::double precision))
							* COS(RADIANS(b.lat))
							* COS(RADIANS(b.lng) - RADIANS($4::double precision))
							+ SIN(RADIANS($3::double precision))
							* SIN(RADIANS(b.lat))
						))
					)
				)::numeric, 2)::double precision
			END AS distance_km,
			COALESCE(matches.match_count, 0) AS match_count,
			COALESCE(sample.products_json, '[]'::json) AS products_sample
		FROM branches b
		LEFT JOIN LATERAL (
			SELECT json_agg(
				json_build_object(
					'dayOfWeek', boh.day_of_week,
					'openTime', TO_CHAR(boh.open_time, 'HH24:MI'),
					'closeTime', TO_CHAR(boh.close_time, 'HH24:MI')
				)
				ORDER BY boh.day_of_week, boh.open_time
			) AS hours_json
			FROM branch_operating_hours boh
			WHERE boh.branch_id = b.id
		) hours ON TRUE
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS match_count
			FROM branch_products bp
			JOIN products p ON p.id = bp.product_id
			WHERE bp.branch_id = b.id
				AND bp.is_enabled = TRUE
				AND bp.is_temporarily_closed = FALSE
				AND p.is_active = TRUE
				AND ($2::bigint IS NULL OR EXISTS (
					SELECT 1
					FROM product_categories pc
					WHERE pc.product_id = p.id AND pc.category_id = $2::bigint
				))
				AND (
					$1 = ''
					OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.search_terms, ''))
						LIKE '%' || $1 || '%'
				)
		) matches ON TRUE
		LEFT JOIN LATERAL (
			SELECT json_agg(
				json_build_object(
					'productId', sample.product_id,
					'name', sample.product_name,
					'imageUrl', sample.image_url,
					'price', sample.price
				)
				ORDER BY sample.sort_order, sample.product_id
			) AS products_json
			FROM (
				SELECT
					p.id AS product_id,
					p.name AS product_name,
					p.image_url,
					COALESCE(bp.price_override, p.base_price)::double precision AS price,
					bp.sort_order
				FROM branch_products bp
				JOIN products p ON p.id = bp.product_id
					WHERE bp.branch_id = b.id
						AND bp.is_enabled = TRUE
						AND bp.is_temporarily_closed = FALSE
						AND p.is_active = TRUE
					AND ($2::bigint IS NULL OR EXISTS (
						SELECT 1
						FROM product_categories pc
						WHERE pc.product_id = p.id AND pc.category_id = $2::bigint
					))
					AND (
						$1 = ''
						OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.search_terms, ''))
							LIKE '%' || $1 || '%'
					)
				ORDER BY bp.is_recommended DESC, bp.sort_order, p.id
				LIMIT 3
			) sample
		) sample ON TRUE
		WHERE (
			($1 = '' AND $2::bigint IS NULL)
			OR matches.match_count > 0
		)
		ORDER BY
			CASE WHEN $3::double precision IS NULL OR $4::double precision IS NULL THEN 1 ELSE 0 END,
			distance_km NULLS LAST,
			b.name
	`, searchQuery, categoryID, lat, lng)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]model.BranchSearchResult, 0)
	for rows.Next() {
		item, err := scanBranchSearchRow(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (s *Store) GetBranchMenuPage(
	ctx context.Context,
	branchID int64,
	search string,
	page int,
	size int,
	featuredOnly bool,
) (model.BranchSummary, []model.MenuItem, int, error) {
	branch, err := s.GetBranchSummary(ctx, branchID)
	if err != nil {
		return model.BranchSummary{}, nil, 0, err
	}

	searchQuery := strings.TrimSpace(strings.ToLower(search))
	var total int
	err = s.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM branch_products bp
		JOIN branches b ON b.id = bp.branch_id
		JOIN products p ON p.id = bp.product_id
		WHERE bp.branch_id = $1
			AND bp.is_enabled = TRUE
			AND bp.is_temporarily_closed = FALSE
			AND b.accepting_orders = TRUE
			AND p.is_active = TRUE
			AND ($2 = '' OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.search_terms, ''))
				LIKE '%' || $2 || '%')
			AND ($3 = FALSE OR bp.is_recommended = TRUE)
	`, branchID, searchQuery, featuredOnly).Scan(&total)
	if err != nil {
		return model.BranchSummary{}, nil, 0, err
	}

	offset := 0
	if !featuredOnly {
		offset = (page - 1) * size
	}
	limit := size
	if featuredOnly {
		limit = 12
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT
			p.id,
			p.name,
			p.description,
			p.image_url,
			COALESCE(bp.price_override, p.base_price)::double precision AS price,
			p.base_price::double precision AS base_price,
			(bp.stock_qty IS NULL OR bp.stock_qty > 0) AND bp.is_temporarily_closed = FALSE AS in_stock,
			bp.stock_qty,
			bp.is_recommended,
			bp.is_temporarily_closed,
			bp.availability_note,
			bp.reorder_level
		FROM branch_products bp
		JOIN branches b ON b.id = bp.branch_id
		JOIN products p ON p.id = bp.product_id
		WHERE bp.branch_id = $1
			AND bp.is_enabled = TRUE
			AND b.accepting_orders = TRUE
			AND p.is_active = TRUE
			AND ($2 = '' OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.search_terms, ''))
				LIKE '%' || $2 || '%')
			AND ($3 = FALSE OR bp.is_recommended = TRUE)
		ORDER BY bp.is_recommended DESC, bp.sort_order, p.id
		LIMIT $4 OFFSET $5
	`, branchID, searchQuery, featuredOnly, limit, offset)
	if err != nil {
		return model.BranchSummary{}, nil, 0, err
	}
	defer rows.Close()

	menu := make([]model.MenuItem, 0)
	productIDs := make([]int64, 0)
	indexByProductID := make(map[int64]int)
	for rows.Next() {
		var (
			description      sql.NullString
			imageURL         sql.NullString
			stockQty         sql.NullInt32
			availabilityNote sql.NullString
			reorderLevel     sql.NullInt32
			item             model.MenuItem
		)
		if err := rows.Scan(
			&item.ProductID,
			&item.Name,
			&description,
			&imageURL,
			&item.Price,
			&item.BasePrice,
			&item.InStock,
			&stockQty,
			&item.IsRecommended,
			&item.IsTemporarilyClosed,
			&availabilityNote,
			&reorderLevel,
		); err != nil {
			return model.BranchSummary{}, nil, 0, err
		}
		item.Description = nullString(description)
		item.ImageURL = nullString(imageURL)
		item.StockQty = nullInt(stockQty)
		item.AvailabilityNote = nullString(availabilityNote)
		item.ReorderLevel = nullInt(reorderLevel)
		menu = append(menu, item)
		productIDs = append(productIDs, item.ProductID)
		indexByProductID[item.ProductID] = len(menu) - 1
	}
	if err := rows.Err(); err != nil {
		return model.BranchSummary{}, nil, 0, err
	}

	if len(productIDs) == 0 {
		return branch, menu, total, nil
	}

	addOnRows, err := s.Pool.Query(ctx, `
		SELECT
			product_id,
			id,
			group_name,
			name,
			price::double precision,
			is_required,
			sort_order
		FROM product_add_ons
		WHERE product_id = ANY($1)
		ORDER BY product_id, sort_order, id
	`, productIDs)
	if err != nil {
		return model.BranchSummary{}, nil, 0, err
	}
	defer addOnRows.Close()

	for addOnRows.Next() {
		var (
			productID int64
			addOn     model.ProductAddOn
		)
		if err := addOnRows.Scan(
			&productID,
			&addOn.ID,
			&addOn.GroupName,
			&addOn.Name,
			&addOn.Price,
			&addOn.IsRequired,
			&addOn.SortOrder,
		); err != nil {
			return model.BranchSummary{}, nil, 0, err
		}
		index, ok := indexByProductID[productID]
		if !ok {
			continue
		}
		menu[index].AddOns = append(menu[index].AddOns, addOn)
	}
	return branch, menu, total, addOnRows.Err()
}

func (s *Store) GetBranchSummary(ctx context.Context, branchID int64) (model.BranchSummary, error) {
	var (
		description     sql.NullString
		imageURL        sql.NullString
		addressLine     sql.NullString
		lat             sql.NullFloat64
		lng             sql.NullFloat64
		operationalNote sql.NullString
		hoursJSON       []byte
		branch          model.BranchSummary
	)

	err := s.Pool.QueryRow(ctx, `
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
			b.operational_note,
			COALESCE((
				SELECT json_agg(
					json_build_object(
						'dayOfWeek', boh.day_of_week,
						'openTime', TO_CHAR(boh.open_time, 'HH24:MI'),
						'closeTime', TO_CHAR(boh.close_time, 'HH24:MI')
					)
					ORDER BY boh.day_of_week, boh.open_time
				)
				FROM branch_operating_hours boh
				WHERE boh.branch_id = b.id
			), '[]'::json)
		FROM branches b
		WHERE b.id = $1
	`, branchID).Scan(
		&branch.ID,
		&branch.CompanyID,
		&branch.Name,
		&branch.Slug,
		&description,
		&imageURL,
		&addressLine,
		&lat,
		&lng,
		&branch.IsForceClosed,
		&branch.AcceptingOrders,
		&branch.SupportsPickup,
		&branch.SupportsRiderDelivery,
		&branch.RiderDeliveryFee,
		&operationalNote,
		&hoursJSON,
	)
	if err != nil {
		return model.BranchSummary{}, err
	}
	branch.Description = nullString(description)
	branch.ImageURL = nullString(imageURL)
	branch.AddressLine = nullString(addressLine)
	branch.Lat = nullFloat(lat)
	branch.Lng = nullFloat(lng)
	branch.OperationalNote = nullString(operationalNote)
	if err := json.Unmarshal(hoursJSON, &branch.OpenHours); err != nil {
		return model.BranchSummary{}, fmt.Errorf("decode branch open hours: %w", err)
	}
	branch.IsOpen = computeBranchOpen(branch.OpenHours, branch.IsForceClosed) && branch.AcceptingOrders
	return branch, nil
}

func (s *Store) GetPaymentMethods(ctx context.Context, companyID int64) ([]model.PaymentMethod, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id,
			pp.code,
			pm.provider_method_code,
			pm.checkout_flow,
			pm.metadata
		FROM company_payment_methods cpm
		JOIN payment_methods pm ON pm.id = cpm.payment_method_id
		JOIN companies c ON c.id = cpm.company_id
		LEFT JOIN payment_providers pp ON pp.id = pm.provider_id
		WHERE cpm.company_id = $1
			AND cpm.is_enabled = TRUE
			AND pm.is_active = TRUE
		ORDER BY cpm.sort_order, pm.id
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	methods := make([]model.PaymentMethod, 0)
	for rows.Next() {
		var (
			promptPayID        sql.NullString
			providerCode       sql.NullString
			providerMethodCode sql.NullString
			metadataJSON       []byte
			item               model.PaymentMethod
		)
		if err := rows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.MethodType,
			&item.SortOrder,
			&promptPayID,
			&providerCode,
			&providerMethodCode,
			&item.CheckoutFlow,
			&metadataJSON,
		); err != nil {
			return nil, err
		}
		item.PromptPayID = nullString(promptPayID)
		item.ProviderCode = nullString(providerCode)
		item.ProviderMethodCode = nullString(providerMethodCode)
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &item.Metadata); err != nil {
				return nil, err
			}
		}
		methods = append(methods, item)
	}
	return methods, rows.Err()
}

func (s *Store) GetPaymentMethod(ctx context.Context, companyID, methodID int64) (model.PaymentMethod, error) {
	var (
		promptPayID        sql.NullString
		providerCode       sql.NullString
		providerMethodCode sql.NullString
		metadataJSON       []byte
		method             model.PaymentMethod
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id,
			pp.code,
			pm.provider_method_code,
			pm.checkout_flow,
			pm.metadata
		FROM company_payment_methods cpm
		JOIN payment_methods pm ON pm.id = cpm.payment_method_id
		JOIN companies c ON c.id = cpm.company_id
		LEFT JOIN payment_providers pp ON pp.id = pm.provider_id
		WHERE cpm.company_id = $1
			AND pm.id = $2
			AND cpm.is_enabled = TRUE
			AND pm.is_active = TRUE
	`, companyID, methodID).Scan(
		&method.ID,
		&method.Code,
		&method.Name,
		&method.MethodType,
		&method.SortOrder,
		&promptPayID,
		&providerCode,
		&providerMethodCode,
		&method.CheckoutFlow,
		&metadataJSON,
	)
	if err != nil {
		return model.PaymentMethod{}, err
	}
	method.PromptPayID = nullString(promptPayID)
	method.ProviderCode = nullString(providerCode)
	method.ProviderMethodCode = nullString(providerMethodCode)
	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &method.Metadata); err != nil {
			return model.PaymentMethod{}, err
		}
	}
	return method, nil
}

func scanBranchSearchRow(scanner interface {
	Scan(dest ...interface{}) error
}) (model.BranchSearchResult, error) {
	var (
		description     sql.NullString
		imageURL        sql.NullString
		addressLine     sql.NullString
		lat             sql.NullFloat64
		lng             sql.NullFloat64
		operationalNote sql.NullString
		hoursJSON       []byte
		sampleJSON      []byte
		row             branchSearchRow
	)

	err := scanner.Scan(
		&row.ID,
		&row.CompanyID,
		&row.Name,
		&row.Slug,
		&description,
		&imageURL,
		&addressLine,
		&lat,
		&lng,
		&row.IsForceClosed,
		&row.AcceptingOrders,
		&row.SupportsPickup,
		&row.SupportsRiderDelivery,
		&row.RiderDeliveryFee,
		&operationalNote,
		&hoursJSON,
		&row.DistanceKM,
		&row.MatchCount,
		&sampleJSON,
	)
	if err != nil {
		return model.BranchSearchResult{}, err
	}

	row.Description = nullString(description)
	row.ImageURL = nullString(imageURL)
	row.AddressLine = nullString(addressLine)
	row.Lat = nullFloat(lat)
	row.Lng = nullFloat(lng)
	row.OperationalNote = nullString(operationalNote)
	if err := json.Unmarshal(hoursJSON, &row.OpenHours); err != nil {
		return model.BranchSearchResult{}, err
	}
	if err := json.Unmarshal(sampleJSON, &row.ProductSample); err != nil {
		return model.BranchSearchResult{}, err
	}
	row.IsOpen = computeBranchOpen(row.OpenHours, row.IsForceClosed) && row.AcceptingOrders

	return model.BranchSearchResult{
		BranchSummary: row.BranchSummary,
		DistanceKM:    row.DistanceKM,
		MatchCount:    row.MatchCount,
		ProductSample: row.ProductSample,
	}, nil
}

func computeBranchOpen(hours []model.OperatingWindow, isForceClosed bool) bool {
	if isForceClosed {
		return false
	}
	if len(hours) == 0 {
		return true
	}

	now := time.Now()
	currentDay := int(now.Weekday())
	currentMinutes := now.Hour()*60 + now.Minute()

	for _, window := range hours {
		if window.DayOfWeek != currentDay {
			continue
		}
		openMinutes := parseClockToMinutes(window.OpenTime)
		closeMinutes := parseClockToMinutes(window.CloseTime)
		if openMinutes < 0 || closeMinutes < 0 {
			continue
		}
		if openMinutes <= closeMinutes {
			if currentMinutes >= openMinutes && currentMinutes <= closeMinutes {
				return true
			}
			continue
		}
		if currentMinutes >= openMinutes || currentMinutes <= closeMinutes {
			return true
		}
	}
	return false
}

func parseClockToMinutes(value string) int {
	if len(value) < 5 {
		return -1
	}
	var hour, minute int
	if _, err := fmt.Sscanf(value[:5], "%d:%d", &hour, &minute); err != nil {
		return -1
	}
	return hour*60 + minute
}
