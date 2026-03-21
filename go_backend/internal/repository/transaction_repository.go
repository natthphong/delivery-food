package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type CreateTransactionParams struct {
	UserID          int64
	CompanyID       int64
	PaymentMethodID int64
	TxnType         string
	Amount          float64
	Status          string
	ExpiresAt       *time.Time
}

type CreateOrderParams struct {
	UserID             int64
	BranchID           int64
	TransactionID      int64
	Status             string
	DeliveryLat        *float64
	DeliveryLng        *float64
	DeliveryDistanceKM *float64
	Items              []model.CartItem
}

type SlipUpdateParams struct {
	TransactionID int64
	Reference     string
	SlipDate      *time.Time
	SlipTimestamp *time.Time
	Metadata      map[string]any
}

func (s *Store) CreateTransaction(ctx context.Context, tx DBTX, params CreateTransactionParams) (model.Transaction, error) {
	var (
		expiresAt sql.NullTime
		item      model.Transaction
	)
	if params.ExpiresAt != nil {
		expiresAt = sql.NullTime{Time: *params.ExpiresAt, Valid: true}
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO transactions (
			user_id,
			company_id,
			payment_method_id,
			txn_type,
			amount,
			status,
			expires_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			user_id,
			company_id,
			payment_method_id,
			txn_type,
			amount::double precision,
			status,
			expires_at,
			slip_reference,
			slip_date,
			slip_timestamp,
			created_at,
			updated_at
	`, params.UserID, params.CompanyID, params.PaymentMethodID, params.TxnType, params.Amount, params.Status, expiresAt).Scan(
		&item.ID,
		&item.UserID,
		&item.CompanyID,
		&item.PaymentMethodID,
		&item.TxnType,
		&item.Amount,
		&item.Status,
		&expiresAt,
		new(sql.NullString),
		new(sql.NullTime),
		new(sql.NullTime),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return model.Transaction{}, err
	}
	item.ExpiresAt = nullTime(expiresAt)
	return item, nil
}

func (s *Store) CreateOrder(ctx context.Context, tx DBTX, params CreateOrderParams) (model.Order, error) {
	var (
		deliveryLat        sql.NullFloat64
		deliveryLng        sql.NullFloat64
		deliveryDistanceKM sql.NullFloat64
		order              model.Order
	)
	if params.DeliveryLat != nil {
		deliveryLat = sql.NullFloat64{Float64: *params.DeliveryLat, Valid: true}
	}
	if params.DeliveryLng != nil {
		deliveryLng = sql.NullFloat64{Float64: *params.DeliveryLng, Valid: true}
	}
	if params.DeliveryDistanceKM != nil {
		deliveryDistanceKM = sql.NullFloat64{Float64: *params.DeliveryDistanceKM, Valid: true}
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO orders (
			user_id,
			branch_id,
			transaction_id,
			status,
			delivery_lat,
			delivery_lng,
			delivery_distance_km
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, branch_id, transaction_id, status, delivery_lat, delivery_lng, delivery_distance_km, created_at, updated_at
	`, params.UserID, params.BranchID, params.TransactionID, params.Status, deliveryLat, deliveryLng, deliveryDistanceKM).Scan(
		&order.ID,
		&order.UserID,
		&order.BranchID,
		&order.TransactionID,
		&order.Status,
		&deliveryLat,
		&deliveryLng,
		&deliveryDistanceKM,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if err != nil {
		return model.Order{}, err
	}
	order.DeliveryLat = nullFloat(deliveryLat)
	order.DeliveryLng = nullFloat(deliveryLng)
	order.DeliveryDistanceKM = nullFloat(deliveryDistanceKM)

	for _, item := range params.Items {
		var orderItemID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, order.ID, item.ProductID, item.ProductName, item.UnitPrice, item.Quantity).Scan(&orderItemID); err != nil {
			return model.Order{}, err
		}
		for _, addOn := range item.AddOns {
			if _, err := tx.Exec(ctx, `
				INSERT INTO order_item_add_ons (order_item_id, name, price)
				VALUES ($1, $2, $3)
			`, orderItemID, addOn.Name, addOn.Price); err != nil {
				return model.Order{}, err
			}
		}
	}
	return order, nil
}

func (s *Store) UpdateTransactionAccepted(ctx context.Context, tx DBTX, params SlipUpdateParams) (model.Transaction, error) {
	metadata, err := json.Marshal(params.Metadata)
	if err != nil {
		return model.Transaction{}, err
	}
	var (
		reference     sql.NullString
		slipDate      sql.NullTime
		slipTimestamp sql.NullTime
		item          model.Transaction
		expiresAt     sql.NullTime
	)
	reference = sql.NullString{String: params.Reference, Valid: params.Reference != ""}
	if params.SlipDate != nil {
		slipDate = sql.NullTime{Time: *params.SlipDate, Valid: true}
	}
	if params.SlipTimestamp != nil {
		slipTimestamp = sql.NullTime{Time: *params.SlipTimestamp, Valid: true}
	}
	err = tx.QueryRow(ctx, `
		UPDATE transactions
		SET
			status = 'accepted',
			slip_reference = $2,
			slip_date = $3,
			slip_timestamp = $4,
			slip_metadata = $5::jsonb,
			updated_at = NOW()
		WHERE id = $1
		RETURNING
			id,
			user_id,
			company_id,
			payment_method_id,
			txn_type,
			amount::double precision,
			status,
			expires_at,
			slip_reference,
			slip_date,
			slip_timestamp,
			created_at,
			updated_at
	`, params.TransactionID, reference, slipDate, slipTimestamp, string(metadata)).Scan(
		&item.ID,
		&item.UserID,
		&item.CompanyID,
		&item.PaymentMethodID,
		&item.TxnType,
		&item.Amount,
		&item.Status,
		&expiresAt,
		&reference,
		&slipDate,
		&slipTimestamp,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return model.Transaction{}, err
	}
	item.ExpiresAt = nullTime(expiresAt)
	item.SlipReference = nullString(reference)
	item.SlipDate = nullTime(slipDate)
	item.SlipTimestamp = nullTime(slipTimestamp)
	return item, nil
}

func (s *Store) UpdateOrderStatusByTransaction(ctx context.Context, tx DBTX, transactionID int64, status string) error {
	_, err := tx.Exec(ctx, `
		UPDATE orders
		SET status = $2,
			updated_at = NOW()
		WHERE transaction_id = $1
	`, transactionID, status)
	return err
}

func (s *Store) GetTransactionSummary(ctx context.Context, userID, transactionID int64) (model.TransactionSummary, error) {
	var (
		expiresAt      sql.NullTime
		slipReference  sql.NullString
		slipDate       sql.NullTime
		slipTimestamp  sql.NullTime
		methodID       sql.NullInt64
		methodCode     sql.NullString
		methodName     sql.NullString
		methodType     sql.NullString
		sortOrder      sql.NullInt32
		promptPayID    sql.NullString
		orderID        sql.NullInt64
		summary        model.TransactionSummary
	)

	err := s.Pool.QueryRow(ctx, `
		SELECT
			t.id,
			t.user_id,
			t.company_id,
			t.payment_method_id,
			t.txn_type,
			t.amount::double precision,
			t.status,
			t.expires_at,
			t.slip_reference,
			t.slip_date,
			t.slip_timestamp,
			t.created_at,
			t.updated_at,
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id,
			o.id
		FROM transactions t
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN company_payment_methods cpm ON cpm.company_id = t.company_id AND cpm.payment_method_id = t.payment_method_id
		LEFT JOIN companies c ON c.id = t.company_id
		LEFT JOIN orders o ON o.transaction_id = t.id
		WHERE t.user_id = $1 AND t.id = $2
	`, userID, transactionID).Scan(
		&summary.ID,
		&summary.UserID,
		&summary.CompanyID,
		&summary.PaymentMethodID,
		&summary.TxnType,
		&summary.Amount,
		&summary.Status,
		&expiresAt,
		&slipReference,
		&slipDate,
		&slipTimestamp,
		&summary.CreatedAt,
		&summary.UpdatedAt,
		&methodID,
		&methodCode,
		&methodName,
		&methodType,
		&sortOrder,
		&promptPayID,
		&orderID,
	)
	if err != nil {
		return model.TransactionSummary{}, err
	}
	summary.ExpiresAt = nullTime(expiresAt)
	summary.SlipReference = nullString(slipReference)
	summary.SlipDate = nullTime(slipDate)
	summary.SlipTimestamp = nullTime(slipTimestamp)
	summary.OrderID = nullInt64(orderID)
	summary.IsExpired = summary.Status == "pending" && summary.ExpiresAt != nil && summary.ExpiresAt.Before(time.Now())
	if methodID.Valid {
		id := methodID.Int64
		method := &model.PaymentMethod{
			ID:          id,
			Code:        methodCode.String,
			Name:        methodName.String,
			MethodType:  methodType.String,
			SortOrder:   int(sortOrder.Int32),
			PromptPayID: nullString(promptPayID),
		}
		summary.Method = method
	}
	return summary, nil
}

func (s *Store) ListTransactions(ctx context.Context, userID int64, limit int) ([]model.TransactionSummary, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			t.id,
			t.user_id,
			t.company_id,
			t.payment_method_id,
			t.txn_type,
			t.amount::double precision,
			t.status,
			t.expires_at,
			t.slip_reference,
			t.slip_date,
			t.slip_timestamp,
			t.created_at,
			t.updated_at,
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id,
			o.id
		FROM transactions t
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN company_payment_methods cpm ON cpm.company_id = t.company_id AND cpm.payment_method_id = t.payment_method_id
		LEFT JOIN companies c ON c.id = t.company_id
		LEFT JOIN orders o ON o.transaction_id = t.id
		WHERE t.user_id = $1
		ORDER BY t.created_at DESC, t.id DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.TransactionSummary, 0, limit)
	for rows.Next() {
		item, err := scanTransactionSummary(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *Store) ListOrders(ctx context.Context, userID int64, limit int) ([]model.Order, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			o.id,
			o.user_id,
			o.branch_id,
			o.transaction_id,
			o.status,
			o.delivery_lat,
			o.delivery_lng,
			o.delivery_distance_km::double precision,
			o.created_at,
			o.updated_at,
			b.company_id,
			b.name,
			b.slug,
			b.description,
			b.image_url,
			b.address_line,
			b.lat,
			b.lng,
			b.is_force_closed,
			t.id,
			t.user_id,
			t.company_id,
			t.payment_method_id,
			t.txn_type,
			t.amount::double precision,
			t.status,
			t.expires_at,
			t.slip_reference,
			t.slip_date,
			t.slip_timestamp,
			t.created_at,
			t.updated_at,
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id
		FROM orders o
		JOIN branches b ON b.id = o.branch_id
		JOIN transactions t ON t.id = o.transaction_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN company_payment_methods cpm ON cpm.company_id = t.company_id AND cpm.payment_method_id = t.payment_method_id
		LEFT JOIN companies c ON c.id = t.company_id
		WHERE o.user_id = $1
		ORDER BY o.created_at DESC, o.id DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]model.Order, 0, limit)
	orderIDs := make([]int64, 0, limit)
	for rows.Next() {
		item, err := scanOrderHeader(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, item)
		orderIDs = append(orderIDs, item.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(orderIDs) == 0 {
		return orders, nil
	}
	if err := s.attachOrderItems(ctx, orders); err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *Store) GetOrderByTransaction(ctx context.Context, userID, transactionID int64) (model.Order, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			o.id,
			o.user_id,
			o.branch_id,
			o.transaction_id,
			o.status,
			o.delivery_lat,
			o.delivery_lng,
			o.delivery_distance_km::double precision,
			o.created_at,
			o.updated_at,
			b.company_id,
			b.name,
			b.slug,
			b.description,
			b.image_url,
			b.address_line,
			b.lat,
			b.lng,
			b.is_force_closed,
			t.id,
			t.user_id,
			t.company_id,
			t.payment_method_id,
			t.txn_type,
			t.amount::double precision,
			t.status,
			t.expires_at,
			t.slip_reference,
			t.slip_date,
			t.slip_timestamp,
			t.created_at,
			t.updated_at,
			pm.id,
			pm.code,
			pm.name,
			pm.method_type,
			cpm.sort_order,
			c.promptpay_id
		FROM orders o
		JOIN branches b ON b.id = o.branch_id
		JOIN transactions t ON t.id = o.transaction_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN company_payment_methods cpm ON cpm.company_id = t.company_id AND cpm.payment_method_id = t.payment_method_id
		LEFT JOIN companies c ON c.id = t.company_id
		WHERE o.user_id = $1 AND o.transaction_id = $2
	`, userID, transactionID)
	if err != nil {
		return model.Order{}, err
	}
	defer rows.Close()
	if !rows.Next() {
		return model.Order{}, sql.ErrNoRows
	}
	order, err := scanOrderHeader(rows)
	if err != nil {
		return model.Order{}, err
	}
	if err := rows.Err(); err != nil {
		return model.Order{}, err
	}
	orders := []model.Order{order}
	if err := s.attachOrderItems(ctx, orders); err != nil {
		return model.Order{}, err
	}
	return orders[0], nil
}

func (s *Store) attachOrderItems(ctx context.Context, orders []model.Order) error {
	orderIDs := make([]int64, 0, len(orders))
	orderIndex := make(map[int64]int, len(orders))
	for index, order := range orders {
		orderIDs = append(orderIDs, order.ID)
		orderIndex[order.ID] = index
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id, order_id, product_id, product_name, unit_price::double precision, quantity
		FROM order_items
		WHERE order_id = ANY($1)
		ORDER BY order_id, id
	`, orderIDs)
	if err != nil {
		return err
	}
	defer rows.Close()

	itemIDs := make([]int64, 0)
	type itemLocation struct {
		orderID int64
		index   int
	}
	itemLocationByID := make(map[int64]itemLocation)
	for rows.Next() {
		var (
			orderID   int64
			productID sql.NullInt64
			item      model.OrderItem
		)
		if err := rows.Scan(&item.ID, &orderID, &productID, &item.ProductName, &item.UnitPrice, &item.Quantity); err != nil {
			return err
		}
		item.ProductID = nullInt64(productID)
		item.LineTotal = item.UnitPrice * float64(item.Quantity)
		order := &orders[orderIndex[orderID]]
		order.Items = append(order.Items, item)
		order.TotalAmount += item.LineTotal
		itemIndex := len(order.Items) - 1
		itemIDs = append(itemIDs, item.ID)
		itemLocationByID[item.ID] = itemLocation{orderID: orderID, index: itemIndex}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(itemIDs) == 0 {
		return nil
	}

	addOnRows, err := s.Pool.Query(ctx, `
		SELECT order_item_id, name, price::double precision
		FROM order_item_add_ons
		WHERE order_item_id = ANY($1)
		ORDER BY id
	`, itemIDs)
	if err != nil {
		return err
	}
	defer addOnRows.Close()
	for addOnRows.Next() {
		var (
			itemID int64
			addOn  model.CartAddOn
		)
		if err := addOnRows.Scan(&itemID, &addOn.Name, &addOn.Price); err != nil {
			return err
		}
		location := itemLocationByID[itemID]
		order := &orders[orderIndex[location.orderID]]
		order.Items[location.index].AddOns = append(order.Items[location.index].AddOns, addOn)
		order.Items[location.index].LineTotal += addOn.Price * float64(order.Items[location.index].Quantity)
		order.TotalAmount += addOn.Price * float64(order.Items[location.index].Quantity)
	}
	return addOnRows.Err()
}

func scanTransactionSummary(scanner interface{ Scan(dest ...interface{}) error }) (model.TransactionSummary, error) {
	var (
		expiresAt      sql.NullTime
		slipReference  sql.NullString
		slipDate       sql.NullTime
		slipTimestamp  sql.NullTime
		methodID       sql.NullInt64
		methodCode     sql.NullString
		methodName     sql.NullString
		methodType     sql.NullString
		sortOrder      sql.NullInt32
		promptPayID    sql.NullString
		orderID        sql.NullInt64
		item           model.TransactionSummary
	)
	err := scanner.Scan(
		&item.ID,
		&item.UserID,
		&item.CompanyID,
		&item.PaymentMethodID,
		&item.TxnType,
		&item.Amount,
		&item.Status,
		&expiresAt,
		&slipReference,
		&slipDate,
		&slipTimestamp,
		&item.CreatedAt,
		&item.UpdatedAt,
		&methodID,
		&methodCode,
		&methodName,
		&methodType,
		&sortOrder,
		&promptPayID,
		&orderID,
	)
	if err != nil {
		return model.TransactionSummary{}, err
	}
	item.ExpiresAt = nullTime(expiresAt)
	item.SlipReference = nullString(slipReference)
	item.SlipDate = nullTime(slipDate)
	item.SlipTimestamp = nullTime(slipTimestamp)
	item.OrderID = nullInt64(orderID)
	item.IsExpired = item.Status == "pending" && item.ExpiresAt != nil && item.ExpiresAt.Before(time.Now())
	if methodID.Valid {
		item.Method = &model.PaymentMethod{
			ID:          methodID.Int64,
			Code:        methodCode.String,
			Name:        methodName.String,
			MethodType:  methodType.String,
			SortOrder:   int(sortOrder.Int32),
			PromptPayID: nullString(promptPayID),
		}
	}
	return item, nil
}

func scanOrderHeader(scanner interface{ Scan(dest ...interface{}) error }) (model.Order, error) {
	var (
		deliveryLat        sql.NullFloat64
		deliveryLng        sql.NullFloat64
		deliveryDistanceKM sql.NullFloat64
		branchDescription  sql.NullString
		branchImage        sql.NullString
		branchAddress      sql.NullString
		branchLat          sql.NullFloat64
		branchLng          sql.NullFloat64
		expiresAt          sql.NullTime
		slipReference      sql.NullString
		slipDate           sql.NullTime
		slipTimestamp      sql.NullTime
		methodID           sql.NullInt64
		methodCode         sql.NullString
		methodName         sql.NullString
		methodType         sql.NullString
		sortOrder          sql.NullInt32
		promptPayID        sql.NullString
		order              model.Order
	)
	order.Branch = &model.BranchSummary{}
	order.Transaction = &model.TransactionSummary{Method: &model.PaymentMethod{}}
	err := scanner.Scan(
		&order.ID,
		&order.UserID,
		&order.BranchID,
		&order.TransactionID,
		&order.Status,
		&deliveryLat,
		&deliveryLng,
		&deliveryDistanceKM,
		&order.CreatedAt,
		&order.UpdatedAt,
		&order.Branch.CompanyID,
		&order.Branch.Name,
		&order.Branch.Slug,
		&branchDescription,
		&branchImage,
		&branchAddress,
		&branchLat,
		&branchLng,
		&order.Branch.IsForceClosed,
		&order.Transaction.ID,
		&order.Transaction.UserID,
		&order.Transaction.CompanyID,
		&order.Transaction.PaymentMethodID,
		&order.Transaction.TxnType,
		&order.Transaction.Amount,
		&order.Transaction.Status,
		&expiresAt,
		&slipReference,
		&slipDate,
		&slipTimestamp,
		&order.Transaction.CreatedAt,
		&order.Transaction.UpdatedAt,
		&methodID,
		&methodCode,
		&methodName,
		&methodType,
		&sortOrder,
		&promptPayID,
	)
	if err != nil {
		return model.Order{}, err
	}
	order.DeliveryLat = nullFloat(deliveryLat)
	order.DeliveryLng = nullFloat(deliveryLng)
	order.DeliveryDistanceKM = nullFloat(deliveryDistanceKM)
	order.Branch.ID = order.BranchID
	order.Branch.Description = nullString(branchDescription)
	order.Branch.ImageURL = nullString(branchImage)
	order.Branch.AddressLine = nullString(branchAddress)
	order.Branch.Lat = nullFloat(branchLat)
	order.Branch.Lng = nullFloat(branchLng)
	order.Transaction.ExpiresAt = nullTime(expiresAt)
	order.Transaction.SlipReference = nullString(slipReference)
	order.Transaction.SlipDate = nullTime(slipDate)
	order.Transaction.SlipTimestamp = nullTime(slipTimestamp)
	order.Transaction.OrderID = &order.ID
	order.Transaction.IsExpired = order.Transaction.Status == "pending" && order.Transaction.ExpiresAt != nil && order.Transaction.ExpiresAt.Before(time.Now())
	if methodID.Valid {
		order.Transaction.Method = &model.PaymentMethod{
			ID:          methodID.Int64,
			Code:        methodCode.String,
			Name:        methodName.String,
			MethodType:  methodType.String,
			SortOrder:   int(sortOrder.Int32),
			PromptPayID: nullString(promptPayID),
		}
	} else {
		order.Transaction.Method = nil
	}
	return order, nil
}
