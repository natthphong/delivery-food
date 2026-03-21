package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type AdminOrderListFilter struct {
	BranchIDs []int64
	Status    string
	Limit     int
}

type DeliveryJobListFilter struct {
	BranchIDs          []int64
	AssignedEmployeeID *int64
	Status             string
	Limit              int
}

type PaymentRecordListFilter struct {
	BranchIDs []int64
	Status    string
	Limit     int
}

type ProviderTransactionRecord struct {
	TransactionID     int64
	UserID            int64
	CompanyID         int64
	TxnType           string
	Amount            float64
	Status            string
	ProviderID        *int64
	ProviderReference *string
	ProviderStatus    *string
	PaymentMethodID   int64
	OrderID           *int64
	OrderStatus       *string
}

func (s *Store) GetAdminOrderByID(ctx context.Context, orderID int64) (model.AdminOrder, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			o.id,
			o.user_id,
			o.branch_id,
			o.transaction_id,
			o.status,
			o.fulfillment_mode,
			o.delivery_fee::double precision,
			o.customer_note,
			o.created_at,
			o.updated_at,
			u.display_name,
			u.phone,
			b.name,
			b.image_url,
			t.amount::double precision,
			t.status,
			pm.name,
			dj.id,
			dj.status,
			rider.full_name
		FROM orders o
		JOIN users u ON u.id = o.user_id
		JOIN branches b ON b.id = o.branch_id
		JOIN transactions t ON t.id = o.transaction_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN delivery_jobs dj ON dj.order_id = o.id
		LEFT JOIN employees rider ON rider.id = dj.assigned_rider_employee_id
		WHERE o.id = $1
	`, orderID)
	return scanAdminOrderSummary(row)
}

func (s *Store) GetAdminOrderDetail(ctx context.Context, orderID int64) (model.AdminOrder, error) {
	item, err := s.GetAdminOrderByID(ctx, orderID)
	if err != nil {
		return model.AdminOrder{}, err
	}
	order, err := s.GetOrderByTransaction(ctx, item.UserID, item.TransactionID)
	if err != nil {
		return model.AdminOrder{}, err
	}
	item.Order = order
	item.CustomerName = item.CustomerName
	item.CustomerPhone = item.CustomerPhone
	item.PaymentMethodName = item.PaymentMethodName
	return item, nil
}

func (s *Store) GetAdminDashboard(ctx context.Context, branchIDs []int64) (model.AdminDashboard, error) {
	var item model.AdminDashboard
	err := s.Pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM employees e WHERE e.status = 'active' AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR EXISTS (
				SELECT 1 FROM employee_branch_assignments eba WHERE eba.employee_id = e.id AND eba.branch_id = ANY($1)
			))),
			(SELECT COUNT(*)::int FROM attendance_sessions a WHERE a.clock_out_at IS NULL AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR a.branch_id = ANY($1))),
			(SELECT COUNT(*)::int FROM ot_requests r WHERE r.status = 'pending' AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR r.branch_id = ANY($1))),
			(SELECT COUNT(*)::int FROM branch_products bp WHERE bp.is_enabled = TRUE AND bp.stock_qty IS NOT NULL AND bp.reorder_level IS NOT NULL AND bp.stock_qty <= bp.reorder_level AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR bp.branch_id = ANY($1))),
			(SELECT COUNT(*)::int FROM orders o WHERE o.status IN ('PENDING', 'PREPARE', 'DELIVERY') AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR o.branch_id = ANY($1))),
			(SELECT COUNT(*)::int FROM delivery_jobs dj WHERE dj.status = 'waiting_for_rider' AND (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR dj.branch_id = ANY($1))),
			(SELECT COUNT(*)::int FROM transactions t LEFT JOIN orders o ON o.transaction_id = t.id WHERE t.status = 'pending' AND (o.id IS NULL OR COALESCE(array_length($1::bigint[], 1), 0) = 0 OR o.branch_id = ANY($1)))
	`, branchIDs).Scan(
		&item.EmployeesActive,
		&item.AttendanceOpen,
		&item.PendingOTRequests,
		&item.LowStockItems,
		&item.PendingOrders,
		&item.WaitingRiderJobs,
		&item.PendingPayments,
	)
	return item, err
}

func (s *Store) ListAdminOrders(ctx context.Context, filter AdminOrderListFilter) ([]model.AdminOrder, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	status := strings.TrimSpace(filter.Status)
	rows, err := s.Pool.Query(ctx, `
		SELECT
			o.id,
			o.user_id,
			o.branch_id,
			o.transaction_id,
			o.status,
			o.fulfillment_mode,
			o.delivery_fee::double precision,
			o.customer_note,
			o.created_at,
			o.updated_at,
			u.display_name,
			u.phone,
			b.name,
			b.image_url,
			t.amount::double precision,
			t.status,
			pm.name,
			dj.id,
			dj.status,
			rider.full_name
		FROM orders o
		JOIN users u ON u.id = o.user_id
		JOIN branches b ON b.id = o.branch_id
		JOIN transactions t ON t.id = o.transaction_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN delivery_jobs dj ON dj.order_id = o.id
		LEFT JOIN employees rider ON rider.id = dj.assigned_rider_employee_id
		WHERE (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR o.branch_id = ANY($1))
			AND ($2 = '' OR o.status = $2)
		ORDER BY o.created_at DESC, o.id DESC
		LIMIT $3
	`, filter.BranchIDs, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.AdminOrder, 0)
	for rows.Next() {
		item, err := scanAdminOrderSummary(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) UpdateOrderStatus(ctx context.Context, tx DBTX, orderID int64, status string) error {
	_, err := tx.Exec(ctx, `
		UPDATE orders
		SET status = $2, updated_at = NOW()
		WHERE id = $1
	`, orderID, strings.TrimSpace(status))
	return err
}

func scanAdminOrderSummary(scanner interface {
	Scan(dest ...interface{}) error
}) (model.AdminOrder, error) {
	var (
		customerName      sql.NullString
		customerPhone     sql.NullString
		customerNote      sql.NullString
		branchName        sql.NullString
		branchImage       sql.NullString
		paymentMethodName sql.NullString
		deliveryJobID     sql.NullInt64
		deliveryJobStatus sql.NullString
		riderName         sql.NullString
		item              model.AdminOrder
	)
	item.Branch = &model.BranchSummary{}
	item.Transaction = &model.TransactionSummary{}
	item.Items = make([]model.OrderItem, 0)
	item.AllowedStatuses = make([]string, 0)
	if err := scanner.Scan(
		&item.ID,
		&item.UserID,
		&item.BranchID,
		&item.TransactionID,
		&item.Status,
		&item.FulfillmentMode,
		&item.DeliveryFee,
		&customerNote,
		&item.CreatedAt,
		&item.UpdatedAt,
		&customerName,
		&customerPhone,
		&branchName,
		&branchImage,
		&item.Transaction.Amount,
		&item.Transaction.Status,
		&paymentMethodName,
		&deliveryJobID,
		&deliveryJobStatus,
		&riderName,
	); err != nil {
		return model.AdminOrder{}, err
	}
	item.CustomerName = nullString(customerName)
	item.CustomerPhone = nullString(customerPhone)
	item.CustomerNote = nullString(customerNote)
	item.PaymentMethodName = nullString(paymentMethodName)
	item.Branch.ID = item.BranchID
	item.Branch.Name = branchName.String
	item.Branch.ImageURL = nullString(branchImage)
	item.TotalAmount = item.Transaction.Amount
	item.Transaction.ID = item.TransactionID
	item.Transaction.UserID = item.UserID
	item.Transaction.OrderID = &item.ID
	if deliveryJobID.Valid {
		item.DeliveryJob = &model.DeliveryJob{
			ID:                deliveryJobID.Int64,
			OrderID:           item.ID,
			BranchID:          item.BranchID,
			Status:            deliveryJobStatus.String,
			AssignedRiderName: nullString(riderName),
		}
		branchLabel := item.Branch.Name
		item.DeliveryJob.BranchName = &branchLabel
	}
	return item, nil
}

func (s *Store) CreateDeliveryJob(ctx context.Context, tx DBTX, orderID, branchID int64, deliveryFee float64) (model.DeliveryJob, error) {
	var item model.DeliveryJob
	err := tx.QueryRow(ctx, `
		INSERT INTO delivery_jobs (order_id, branch_id, delivery_fee)
		VALUES ($1, $2, $3)
		RETURNING id, order_id, branch_id, status, delivery_fee::double precision, assigned_rider_employee_id, claimed_at, picked_up_at, delivered_at, failed_reason, created_at, updated_at
	`, orderID, branchID, deliveryFee).Scan(
		&item.ID,
		&item.OrderID,
		&item.BranchID,
		&item.Status,
		&item.DeliveryFee,
		new(sql.NullInt64),
		new(sql.NullTime),
		new(sql.NullTime),
		new(sql.NullTime),
		new(sql.NullString),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return model.DeliveryJob{}, err
	}
	return item, nil
}

func (s *Store) ListDeliveryJobs(ctx context.Context, filter DeliveryJobListFilter) ([]model.DeliveryJob, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	status := strings.TrimSpace(filter.Status)
	rows, err := s.Pool.Query(ctx, `
		SELECT
			dj.id,
			dj.order_id,
			dj.branch_id,
			b.name,
			dj.status,
			dj.delivery_fee::double precision,
			dj.assigned_rider_employee_id,
			rider.full_name,
			dj.claimed_at,
			dj.picked_up_at,
			dj.delivered_at,
			dj.failed_reason,
			dj.created_at,
			dj.updated_at
		FROM delivery_jobs dj
		JOIN branches b ON b.id = dj.branch_id
		LEFT JOIN employees rider ON rider.id = dj.assigned_rider_employee_id
		WHERE (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR dj.branch_id = ANY($1))
			AND ($2::bigint IS NULL OR dj.assigned_rider_employee_id = $2)
			AND ($3 = '' OR dj.status = $3)
		ORDER BY dj.created_at DESC, dj.id DESC
		LIMIT $4
	`, filter.BranchIDs, filter.AssignedEmployeeID, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.DeliveryJob, 0)
	for rows.Next() {
		item, err := scanDeliveryJob(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetDeliveryJob(ctx context.Context, jobID int64) (model.DeliveryJob, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			dj.id,
			dj.order_id,
			dj.branch_id,
			b.name,
			dj.status,
			dj.delivery_fee::double precision,
			dj.assigned_rider_employee_id,
			rider.full_name,
			dj.claimed_at,
			dj.picked_up_at,
			dj.delivered_at,
			dj.failed_reason,
			dj.created_at,
			dj.updated_at
		FROM delivery_jobs dj
		JOIN branches b ON b.id = dj.branch_id
		LEFT JOIN employees rider ON rider.id = dj.assigned_rider_employee_id
		WHERE dj.id = $1
	`, jobID)
	return scanDeliveryJob(row)
}

func (s *Store) ClaimDeliveryJob(ctx context.Context, tx DBTX, jobID int64, riderEmployeeID int64) (model.DeliveryJob, error) {
	if _, err := tx.Exec(ctx, `
		UPDATE delivery_jobs
		SET
			assigned_rider_employee_id = $2,
			status = 'assigned_to_rider',
			claimed_at = NOW(),
			updated_at = NOW()
		WHERE id = $1
			AND status = 'waiting_for_rider'
			AND assigned_rider_employee_id IS NULL
	`, jobID, riderEmployeeID); err != nil {
		return model.DeliveryJob{}, err
	}
	return s.GetDeliveryJob(ctx, jobID)
}

func (s *Store) UpdateDeliveryJobStatus(ctx context.Context, tx DBTX, jobID int64, status string, failedReason *string) (model.DeliveryJob, error) {
	var reason sql.NullString
	if failedReason != nil {
		reason = sql.NullString{String: strings.TrimSpace(*failedReason), Valid: strings.TrimSpace(*failedReason) != ""}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE delivery_jobs
		SET
			status = $2,
			picked_up_at = CASE WHEN $2 = 'picked_up' THEN NOW() ELSE picked_up_at END,
			delivered_at = CASE WHEN $2 = 'delivered' THEN NOW() ELSE delivered_at END,
			failed_reason = CASE WHEN $2 = 'failed_delivery' THEN $3 ELSE failed_reason END,
			updated_at = NOW()
		WHERE id = $1
	`, jobID, strings.TrimSpace(status), reason); err != nil {
		return model.DeliveryJob{}, err
	}
	return s.GetDeliveryJob(ctx, jobID)
}

func (s *Store) CancelDeliveryJobByOrderID(ctx context.Context, tx DBTX, orderID int64, failedReason *string) error {
	var reason sql.NullString
	if failedReason != nil {
		reason = sql.NullString{String: strings.TrimSpace(*failedReason), Valid: strings.TrimSpace(*failedReason) != ""}
	}
	_, err := tx.Exec(ctx, `
		UPDATE delivery_jobs
		SET status = 'cancelled', failed_reason = COALESCE($2, failed_reason), updated_at = NOW()
		WHERE order_id = $1
	`, orderID, reason)
	return err
}

func (s *Store) ListPaymentProviders(ctx context.Context) ([]model.PaymentProvider, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, code, name, is_active, public_key, settings, created_at, updated_at
		FROM payment_providers
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.PaymentProvider, 0)
	for rows.Next() {
		var (
			publicKey    sql.NullString
			settingsJSON []byte
			item         model.PaymentProvider
		)
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.IsActive, &publicKey, &settingsJSON, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.PublicKey = nullString(publicKey)
		if len(settingsJSON) > 0 {
			if err := json.Unmarshal(settingsJSON, &item.Settings); err != nil {
				return nil, err
			}
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetPaymentProviderByCode(ctx context.Context, code string) (model.PaymentProvider, error) {
	var (
		publicKey    sql.NullString
		settingsJSON []byte
		item         model.PaymentProvider
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT id, code, name, is_active, public_key, settings, created_at, updated_at
		FROM payment_providers
		WHERE code = $1
	`, strings.TrimSpace(code)).Scan(&item.ID, &item.Code, &item.Name, &item.IsActive, &publicKey, &settingsJSON, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return model.PaymentProvider{}, err
	}
	item.PublicKey = nullString(publicKey)
	if len(settingsJSON) > 0 {
		if err := json.Unmarshal(settingsJSON, &item.Settings); err != nil {
			return model.PaymentProvider{}, err
		}
	}
	return item, nil
}

func (s *Store) ListAdminPayments(ctx context.Context, filter PaymentRecordListFilter) ([]model.AdminPaymentRecord, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	status := strings.TrimSpace(filter.Status)
	rows, err := s.Pool.Query(ctx, `
		SELECT
			t.id,
			t.user_id,
			u.display_name,
			o.branch_id,
			b.name,
			o.id,
			pm.name,
			pp.code,
			t.status,
			t.provider_status,
			t.amount::double precision,
			t.created_at,
			t.updated_at,
			t.paid_at
		FROM transactions t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN orders o ON o.transaction_id = t.id
		LEFT JOIN branches b ON b.id = o.branch_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		LEFT JOIN payment_providers pp ON pp.id = t.provider_id
		WHERE (COALESCE(array_length($1::bigint[], 1), 0) = 0 OR o.branch_id = ANY($1))
			AND ($2 = '' OR t.status = $2)
		ORDER BY t.created_at DESC, t.id DESC
		LIMIT $3
	`, filter.BranchIDs, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.AdminPaymentRecord, 0)
	for rows.Next() {
		var (
			customerName   sql.NullString
			branchID       sql.NullInt64
			branchName     sql.NullString
			orderID        sql.NullInt64
			methodName     sql.NullString
			providerCode   sql.NullString
			providerStatus sql.NullString
			paidAt         sql.NullTime
			item           model.AdminPaymentRecord
		)
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&customerName,
			&branchID,
			&branchName,
			&orderID,
			&methodName,
			&providerCode,
			&item.Status,
			&providerStatus,
			&item.Amount,
			&item.CreatedAt,
			&item.UpdatedAt,
			&paidAt,
		); err != nil {
			return nil, err
		}
		item.CustomerName = nullString(customerName)
		item.BranchID = nullInt64(branchID)
		item.BranchName = nullString(branchName)
		item.OrderID = nullInt64(orderID)
		item.PaymentMethodName = nullString(methodName)
		item.ProviderCode = nullString(providerCode)
		item.ProviderStatus = nullString(providerStatus)
		item.PaidAt = nullTime(paidAt)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListPaymentWebhookEvents(ctx context.Context, limit int) ([]model.PaymentWebhookEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, provider_id, external_event_id, event_type, payload, status, error_message, received_at, processed_at
		FROM payment_webhook_events
		ORDER BY received_at DESC, id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.PaymentWebhookEvent, 0)
	for rows.Next() {
		var (
			externalEventID sql.NullString
			payloadJSON     []byte
			errorMessage    sql.NullString
			processedAt     sql.NullTime
			item            model.PaymentWebhookEvent
		)
		if err := rows.Scan(&item.ID, &item.ProviderID, &externalEventID, &item.EventType, &payloadJSON, &item.Status, &errorMessage, &item.ReceivedAt, &processedAt); err != nil {
			return nil, err
		}
		item.ExternalEventID = nullString(externalEventID)
		item.ErrorMessage = nullString(errorMessage)
		item.ProcessedAt = nullTime(processedAt)
		if len(payloadJSON) > 0 {
			if err := json.Unmarshal(payloadJSON, &item.Payload); err != nil {
				return nil, err
			}
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) InsertPaymentWebhookEvent(ctx context.Context, tx DBTX, providerID int64, externalEventID *string, eventType string, payload map[string]any) (int64, error) {
	var (
		eventID     sql.NullInt64
		externalID  sql.NullString
		payloadJSON []byte
	)
	if externalEventID != nil {
		externalID = sql.NullString{String: strings.TrimSpace(*externalEventID), Valid: strings.TrimSpace(*externalEventID) != ""}
	}
	if payload != nil {
		bytes, err := json.Marshal(payload)
		if err != nil {
			return 0, err
		}
		payloadJSON = bytes
	} else {
		payloadJSON = []byte(`{}`)
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO payment_webhook_events (provider_id, external_event_id, event_type, payload)
		VALUES ($1, $2, $3, $4::jsonb)
		ON CONFLICT (provider_id, external_event_id)
		DO UPDATE SET payload = EXCLUDED.payload
		RETURNING id
	`, providerID, externalID, strings.TrimSpace(eventType), string(payloadJSON)).Scan(&eventID)
	if err != nil {
		return 0, err
	}
	return eventID.Int64, nil
}

func (s *Store) UpdatePaymentWebhookEventStatus(ctx context.Context, tx DBTX, eventID int64, status string, errorMessage *string) error {
	var message sql.NullString
	if errorMessage != nil {
		message = sql.NullString{String: strings.TrimSpace(*errorMessage), Valid: strings.TrimSpace(*errorMessage) != ""}
	}
	_, err := tx.Exec(ctx, `
		UPDATE payment_webhook_events
		SET status = $2, error_message = $3, processed_at = NOW()
		WHERE id = $1
	`, eventID, strings.TrimSpace(status), message)
	return err
}

func (s *Store) GetTransactionByProviderReference(ctx context.Context, providerReference string) (ProviderTransactionRecord, error) {
	var (
		providerID     sql.NullInt64
		providerStatus sql.NullString
		reference      sql.NullString
		orderID        sql.NullInt64
		orderStatus    sql.NullString
		item           ProviderTransactionRecord
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT
			t.id,
			t.user_id,
			t.company_id,
			t.txn_type,
			t.amount::double precision,
			t.status,
			t.provider_id,
			t.provider_reference,
			t.provider_status,
			t.payment_method_id,
			o.id,
			o.status
		FROM transactions t
		LEFT JOIN orders o ON o.transaction_id = t.id
		WHERE t.provider_reference = $1
	`, strings.TrimSpace(providerReference)).Scan(
		&item.TransactionID,
		&item.UserID,
		&item.CompanyID,
		&item.TxnType,
		&item.Amount,
		&item.Status,
		&providerID,
		&reference,
		&providerStatus,
		&item.PaymentMethodID,
		&orderID,
		&orderStatus,
	)
	if err != nil {
		return ProviderTransactionRecord{}, err
	}
	item.ProviderID = nullInt64(providerID)
	item.ProviderReference = nullString(reference)
	item.ProviderStatus = nullString(providerStatus)
	item.OrderID = nullInt64(orderID)
	item.OrderStatus = nullString(orderStatus)
	return item, nil
}

func (s *Store) UpdateTransactionGatewayState(
	ctx context.Context,
	tx DBTX,
	transactionID int64,
	status string,
	providerStatus *string,
	paymentAction map[string]any,
	failedReason *string,
	paidAt *time.Time,
	expiresAt *time.Time,
) error {
	var (
		providerStatusValue sql.NullString
		failedReasonValue   sql.NullString
		paidAtValue         sql.NullTime
		expiresAtValue      sql.NullTime
		payloadJSON         []byte
	)
	if providerStatus != nil {
		providerStatusValue = sql.NullString{String: strings.TrimSpace(*providerStatus), Valid: strings.TrimSpace(*providerStatus) != ""}
	}
	if failedReason != nil {
		failedReasonValue = sql.NullString{String: strings.TrimSpace(*failedReason), Valid: strings.TrimSpace(*failedReason) != ""}
	}
	if paidAt != nil {
		paidAtValue = sql.NullTime{Time: *paidAt, Valid: true}
	}
	if expiresAt != nil {
		expiresAtValue = sql.NullTime{Time: *expiresAt, Valid: true}
	}
	if paymentAction != nil {
		bytes, err := json.Marshal(paymentAction)
		if err != nil {
			return err
		}
		payloadJSON = bytes
	} else {
		payloadJSON = []byte(`{}`)
	}
	_, err := tx.Exec(ctx, `
		UPDATE transactions
		SET
			status = $2,
			provider_status = COALESCE($3, provider_status),
			payment_action = CASE WHEN $4::jsonb = '{}'::jsonb THEN payment_action ELSE $4::jsonb END,
			failed_reason = COALESCE($5, failed_reason),
			paid_at = COALESCE($6, paid_at),
			expires_at = COALESCE($7, expires_at),
			updated_at = NOW()
		WHERE id = $1
	`, transactionID, strings.TrimSpace(status), providerStatusValue, string(payloadJSON), failedReasonValue, paidAtValue, expiresAtValue)
	return err
}

func scanDeliveryJob(scanner interface {
	Scan(dest ...interface{}) error
}) (model.DeliveryJob, error) {
	var (
		assignedEmployeeID sql.NullInt64
		branchName         sql.NullString
		riderName          sql.NullString
		claimedAt          sql.NullTime
		pickedUpAt         sql.NullTime
		deliveredAt        sql.NullTime
		failedReason       sql.NullString
		item               model.DeliveryJob
	)
	if err := scanner.Scan(
		&item.ID,
		&item.OrderID,
		&item.BranchID,
		&branchName,
		&item.Status,
		&item.DeliveryFee,
		&assignedEmployeeID,
		&riderName,
		&claimedAt,
		&pickedUpAt,
		&deliveredAt,
		&failedReason,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return model.DeliveryJob{}, err
	}
	item.BranchName = nullString(branchName)
	item.AssignedRiderEmployeeID = nullInt64(assignedEmployeeID)
	item.AssignedRiderName = nullString(riderName)
	item.ClaimedAt = nullTime(claimedAt)
	item.PickedUpAt = nullTime(pickedUpAt)
	item.DeliveredAt = nullTime(deliveredAt)
	item.FailedReason = nullString(failedReason)
	return item, nil
}
