package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

type CheckoutResult struct {
	Method      model.PaymentMethod      `json:"method"`
	Transaction model.TransactionSummary `json:"transaction"`
	Order       *model.Order             `json:"order,omitempty"`
	Cart        model.Cart               `json:"cart"`
	User        *model.User              `json:"user,omitempty"`
}

type DepositResult struct {
	Transaction model.TransactionSummary `json:"transaction"`
}

type TransactionDetailResult struct {
	Transaction model.TransactionSummary `json:"transaction"`
	Order       *model.Order             `json:"order,omitempty"`
	User        *model.User              `json:"user,omitempty"`
}

type PaymentService struct {
	store      *repository.Store
	config     config.Config
	httpClient *http.Client
	gateways   map[string]PaymentGateway
}

func NewPaymentService(store *repository.Store, cfg config.Config) *PaymentService {
	client := &http.Client{Timeout: cfg.HTTPClientTimeout}
	return &PaymentService{
		store:      store,
		config:     cfg,
		httpClient: client,
		gateways: map[string]PaymentGateway{
			"OMISE": NewOmiseGateway(client, cfg),
		},
	}
}

func (s *PaymentService) Checkout(ctx context.Context, userID int64, request dto.CheckoutRequest) (CheckoutResult, error) {
	if request.BranchID <= 0 || request.PaymentMethodID <= 0 {
		return CheckoutResult{}, apperror.BadRequest("branchId and paymentMethodId are required")
	}
	if len(request.SelectedItemIDs) == 0 {
		return CheckoutResult{}, apperror.BadRequest("selectedItemIds is required")
	}
	fulfillmentMode := strings.TrimSpace(request.FulfillmentMode)
	if fulfillmentMode == "" {
		fulfillmentMode = "pickup"
	}
	if fulfillmentMode != "pickup" && fulfillmentMode != "rider_delivery" {
		return CheckoutResult{}, apperror.BadRequest("fulfillmentMode must be pickup or rider_delivery")
	}

	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return CheckoutResult{}, err
	}
	branch, err := s.store.GetBranchSummary(ctx, request.BranchID)
	if err != nil {
		if repository.IsNotFound(err) {
			return CheckoutResult{}, apperror.NotFound("branch not found")
		}
		return CheckoutResult{}, apperror.Internal("failed to load branch", err)
	}
	if branch.IsForceClosed || !branch.AcceptingOrders {
		return CheckoutResult{}, apperror.Conflict("branch is not accepting orders")
	}
	if fulfillmentMode == "pickup" && !branch.SupportsPickup {
		return CheckoutResult{}, apperror.Conflict("branch does not support pickup")
	}
	if fulfillmentMode == "rider_delivery" && !branch.SupportsRiderDelivery {
		return CheckoutResult{}, apperror.Conflict("branch does not support rider delivery")
	}

	method, err := s.store.GetPaymentMethod(ctx, branch.CompanyID, request.PaymentMethodID)
	if err != nil {
		if repository.IsNotFound(err) {
			return CheckoutResult{}, apperror.NotFound("payment method not available")
		}
		return CheckoutResult{}, apperror.Internal("failed to load payment method", err)
	}

	items, cartID, err := s.store.GetCartItemsByIDs(ctx, userID, uniqueIDs(request.SelectedItemIDs))
	if err != nil {
		if repository.IsNotFound(err) {
			return CheckoutResult{}, apperror.NotFound("one or more selected cart items were not found")
		}
		return CheckoutResult{}, apperror.Internal("failed to load selected cart items", err)
	}
	for _, item := range items {
		if item.BranchID != request.BranchID {
			return CheckoutResult{}, apperror.BadRequest("checkout items must belong to the same branch")
		}
		product, err := s.store.GetSellableProduct(ctx, item.BranchID, item.ProductID)
		if err != nil {
			if repository.IsNotFound(err) {
				return CheckoutResult{}, apperror.Conflict("one or more selected items are no longer available")
			}
			return CheckoutResult{}, apperror.Internal("failed to validate checkout items", err)
		}
		if product.StockQty != nil && item.Quantity > *product.StockQty {
			return CheckoutResult{}, apperror.Conflict("requested quantity exceeds stock")
		}
	}

	itemsTotal := 0.0
	for _, item := range items {
		itemsTotal += item.LineTotal
	}
	deliveryFee := 0.0
	if fulfillmentMode == "rider_delivery" {
		deliveryFee = branch.RiderDeliveryFee
	}
	totalAmount := itemsTotal + deliveryFee
	if totalAmount <= 0 {
		return CheckoutResult{}, apperror.BadRequest("checkout amount must be greater than 0")
	}

	user, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to load user", err)
	}

	transactionStatus := "pending"
	orderStatus := "PENDING"
	var expiresAt *time.Time
	var paymentAction map[string]any
	var providerID *int64
	var providerReference *string
	var providerStatus *string
	if method.MethodType == "balance" {
		if user.WalletBalance < totalAmount {
			return CheckoutResult{}, apperror.Conflict("wallet balance is insufficient")
		}
		transactionStatus = "accepted"
		orderStatus = "PREPARE"
	} else if method.MethodType == "qr" {
		ttlSeconds := configInt(configs, "QR_PAYMENT_TTL_SECONDS", 900)
		expires := time.Now().Add(time.Duration(ttlSeconds) * time.Second)
		expiresAt = &expires
		paymentAction = buildManualPaymentAction(method, totalAmount, expires)
	} else if method.MethodType == "gateway" {
		if method.ProviderCode == nil {
			return CheckoutResult{}, apperror.BadRequest("payment provider is not configured")
		}
		provider, err := s.store.GetPaymentProviderByCode(ctx, *method.ProviderCode)
		if err != nil {
			if repository.IsNotFound(err) {
				return CheckoutResult{}, apperror.NotFound("payment provider not found")
			}
			return CheckoutResult{}, apperror.Internal("failed to load payment provider", err)
		}
		gateway, ok := s.gateways[strings.ToUpper(provider.Code)]
		if !ok {
			return CheckoutResult{}, apperror.BadRequest("payment provider is not supported")
		}
		gatewayResult, err := gateway.CreateCheckout(ctx, provider, method, GatewayCheckoutRequest{
			Amount:      totalAmount,
			Currency:    "THB",
			BranchName:  branch.Name,
			Description: fmt.Sprintf("Order #%d at %s", time.Now().Unix(), branch.Name),
		})
		if err != nil {
			return CheckoutResult{}, err
		}
		providerID = &provider.ID
		providerReference = &gatewayResult.ProviderReference
		providerStatus = &gatewayResult.ProviderStatus
		paymentAction = gatewayResult.PaymentAction
	} else {
		return CheckoutResult{}, apperror.BadRequest("unsupported payment method")
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to begin checkout", err)
	}
	defer tx.Rollback(ctx)

	transaction, err := s.store.CreateTransaction(ctx, tx, repository.CreateTransactionParams{
		UserID:          userID,
		CompanyID:       branch.CompanyID,
		PaymentMethodID: method.ID,
		TxnType:         "payment",
		Amount:          totalAmount,
		Status:          transactionStatus,
		ExpiresAt:       expiresAt,
		ProviderID:      providerID,
		ProviderReference: providerReference,
		ProviderStatus:  providerStatus,
		PaymentAction:   paymentAction,
	})
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to create transaction", err)
	}

	order, err := s.store.CreateOrder(ctx, tx, repository.CreateOrderParams{
		UserID:             userID,
		BranchID:           branch.ID,
		TransactionID:      transaction.ID,
		Status:             orderStatus,
		FulfillmentMode:    fulfillmentMode,
		DeliveryFee:        deliveryFee,
		CustomerNote:       optionalString(request.CustomerNote),
		DeliveryLat:        &request.DeliveryLat,
		DeliveryLng:        &request.DeliveryLng,
		DeliveryDistanceKM: &request.DeliveryDistance,
		Items:              items,
	})
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to create order", err)
	}

	if method.MethodType == "balance" {
		if _, err := s.store.AdjustWalletBalance(ctx, tx, userID, -totalAmount); err != nil {
			return CheckoutResult{}, apperror.Conflict("wallet balance is insufficient")
		}
	}
	if fulfillmentMode == "rider_delivery" && transactionStatus == "accepted" {
		if _, err := s.store.CreateDeliveryJob(ctx, tx, order.ID, branch.ID, deliveryFee); err != nil {
			return CheckoutResult{}, apperror.Internal("failed to create delivery job", err)
		}
	}

	if err := s.store.DeleteCartItemsByIDs(ctx, tx, cartID, uniqueIDs(request.SelectedItemIDs)); err != nil {
		return CheckoutResult{}, apperror.Internal("failed to remove checked-out cart items", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return CheckoutResult{}, apperror.Internal("failed to commit checkout", err)
	}

	result, err := s.GetTransactionDetail(ctx, userID, transaction.ID)
	if err != nil {
		return CheckoutResult{}, err
	}
	cart, err := s.store.GetCart(ctx, userID)
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to refresh cart", err)
	}

	checkout := CheckoutResult{
		Method:      method,
		Transaction: result.Transaction,
		Order:       result.Order,
		Cart:        cart,
	}
	if method.MethodType == "balance" {
		freshUser, err := s.store.GetUserByID(ctx, userID)
		if err == nil {
			checkout.User = &freshUser
		}
	}
	return checkout, nil
}

func (s *PaymentService) CreateDeposit(ctx context.Context, userID int64, request dto.DepositRequest) (DepositResult, error) {
	if request.CompanyID <= 0 || request.PaymentMethodID <= 0 {
		return DepositResult{}, apperror.BadRequest("companyId and paymentMethodId are required")
	}
	if request.Amount <= 0 {
		return DepositResult{}, apperror.BadRequest("amount must be greater than 0")
	}

	method, err := s.store.GetPaymentMethod(ctx, request.CompanyID, request.PaymentMethodID)
	if err != nil {
		if repository.IsNotFound(err) {
			return DepositResult{}, apperror.NotFound("payment method not available")
		}
		return DepositResult{}, apperror.Internal("failed to load payment method", err)
	}
	if method.MethodType != "qr" {
		return DepositResult{}, apperror.BadRequest("deposits must use a QR payment method")
	}

	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return DepositResult{}, err
	}
	ttlSeconds := configInt(configs, "QR_PAYMENT_TTL_SECONDS", 900)
	expiresAt := time.Now().Add(time.Duration(ttlSeconds) * time.Second)

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return DepositResult{}, apperror.Internal("failed to begin deposit", err)
	}
	defer tx.Rollback(ctx)
	transaction, err := s.store.CreateTransaction(ctx, tx, repository.CreateTransactionParams{
		UserID:          userID,
		CompanyID:       request.CompanyID,
		PaymentMethodID: method.ID,
		TxnType:         "deposit",
		Amount:          request.Amount,
		Status:          "pending",
		ExpiresAt:       &expiresAt,
		PaymentAction:   buildManualPaymentAction(method, request.Amount, expiresAt),
	})
	if err != nil {
		return DepositResult{}, apperror.Internal("failed to create deposit", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return DepositResult{}, apperror.Internal("failed to commit deposit", err)
	}

	summary, err := s.store.GetTransactionSummary(ctx, userID, transaction.ID)
	if err != nil {
		return DepositResult{}, apperror.Internal("failed to refresh deposit", err)
	}
	return DepositResult{Transaction: summary}, nil
}

func (s *PaymentService) GetTransactionDetail(ctx context.Context, userID int64, transactionID int64) (TransactionDetailResult, error) {
	summary, err := s.store.GetTransactionSummary(ctx, userID, transactionID)
	if err != nil {
		if repository.IsNotFound(err) {
			return TransactionDetailResult{}, apperror.NotFound("transaction not found")
		}
		return TransactionDetailResult{}, apperror.Internal("failed to load transaction", err)
	}

	var order *model.Order
	if summary.OrderID != nil {
		item, err := s.store.GetOrderByTransaction(ctx, userID, transactionID)
		if err == nil {
			order = &item
		}
	}

	return TransactionDetailResult{
		Transaction: summary,
		Order:       order,
	}, nil
}

func (s *PaymentService) SubmitSlip(
	ctx context.Context,
	userID int64,
	transactionID int64,
	fileName string,
	fileContents []byte,
) (TransactionDetailResult, error) {
	if len(fileContents) == 0 {
		return TransactionDetailResult{}, apperror.BadRequest("slip file is required")
	}

	detail, err := s.GetTransactionDetail(ctx, userID, transactionID)
	if err != nil {
		return TransactionDetailResult{}, err
	}
	if detail.Transaction.Status != "pending" {
		return TransactionDetailResult{}, apperror.Conflict("transaction is no longer pending")
	}
	if detail.Transaction.IsExpired {
		return TransactionDetailResult{}, apperror.Conflict("transaction has expired")
	}
	if detail.Transaction.Method == nil || detail.Transaction.Method.MethodType != "qr" {
		return TransactionDetailResult{}, apperror.BadRequest("transaction does not support slip upload")
	}

	slipParams, err := s.verifySlip(ctx, detail.Transaction, fileName, fileContents)
	if err != nil {
		return TransactionDetailResult{}, err
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return TransactionDetailResult{}, apperror.Internal("failed to accept slip", err)
	}
	defer tx.Rollback(ctx)

	if _, err := s.store.UpdateTransactionAccepted(ctx, tx, slipParams); err != nil {
		return TransactionDetailResult{}, apperror.Internal("failed to accept transaction", err)
	}

	var updatedUser *model.User
	switch detail.Transaction.TxnType {
	case "deposit":
		if _, err := s.store.AdjustWalletBalance(ctx, tx, userID, detail.Transaction.Amount); err != nil {
			return TransactionDetailResult{}, apperror.Internal("failed to update wallet", err)
		}
	case "payment":
		if err := s.store.UpdateOrderStatusByTransaction(ctx, tx, transactionID, "PREPARE"); err != nil {
			return TransactionDetailResult{}, apperror.Internal("failed to update order status", err)
		}
		if detail.Order != nil && detail.Order.FulfillmentMode == "rider_delivery" && detail.Order.DeliveryJob == nil {
			if _, err := s.store.CreateDeliveryJob(ctx, tx, detail.Order.ID, detail.Order.BranchID, detail.Order.DeliveryFee); err != nil {
				return TransactionDetailResult{}, apperror.Internal("failed to create delivery job", err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return TransactionDetailResult{}, apperror.Internal("failed to commit slip", err)
	}

	result, err := s.GetTransactionDetail(ctx, userID, transactionID)
	if err != nil {
		return TransactionDetailResult{}, err
	}
	if detail.Transaction.TxnType == "deposit" {
		user, err := s.store.GetUserByID(ctx, userID)
		if err == nil {
			updatedUser = &user
		}
	}
	result.User = updatedUser
	return result, nil
}

func (s *PaymentService) HandleOmiseWebhook(ctx context.Context, headers http.Header, body []byte) (map[string]any, error) {
	provider, err := s.store.GetPaymentProviderByCode(ctx, "OMISE")
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, apperror.NotFound("payment provider not found")
		}
		return nil, apperror.Internal("failed to load payment provider", err)
	}
	gateway, ok := s.gateways["OMISE"]
	if !ok {
		return nil, apperror.BadRequest("Omise gateway is not configured")
	}
	webhook, err := gateway.ParseWebhook(ctx, provider, headers, body)
	if err != nil {
		return nil, err
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin webhook handling", err)
	}
	defer tx.Rollback(ctx)

	eventID, err := s.store.InsertPaymentWebhookEvent(ctx, tx, provider.ID, webhook.EventID, webhook.EventType, webhook.Payload)
	if err != nil {
		return nil, apperror.Internal("failed to record webhook event", err)
	}

	if strings.TrimSpace(webhook.ProviderReference) == "" {
		message := "webhook did not contain a provider reference"
		if err := s.store.UpdatePaymentWebhookEventStatus(ctx, tx, eventID, "ignored", &message); err != nil {
			return nil, apperror.Internal("failed to mark webhook event", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apperror.Internal("failed to commit webhook event", err)
		}
		return map[string]any{"processed": false, "reason": message}, nil
	}

	record, err := s.store.GetTransactionByProviderReference(ctx, webhook.ProviderReference)
	if err != nil {
		if repository.IsNotFound(err) {
			message := "transaction was not found for provider reference"
			if err := s.store.UpdatePaymentWebhookEventStatus(ctx, tx, eventID, "ignored", &message); err != nil {
				return nil, apperror.Internal("failed to mark webhook event", err)
			}
			if err := tx.Commit(ctx); err != nil {
				return nil, apperror.Internal("failed to commit webhook event", err)
			}
			return map[string]any{"processed": false, "reason": message}, nil
		}
		return nil, apperror.Internal("failed to resolve transaction from provider reference", err)
	}

	if err := s.store.UpdateTransactionGatewayState(ctx, tx, record.TransactionID, webhook.Status, &webhook.ProviderStatus, nil, webhook.FailedReason, webhook.PaidAt); err != nil {
		return nil, apperror.Internal("failed to update transaction state", err)
	}

	if record.Status != webhook.Status {
		switch webhook.Status {
		case "accepted":
			if record.TxnType == "deposit" {
				if _, err := s.store.AdjustWalletBalance(ctx, tx, record.UserID, record.Amount); err != nil {
					return nil, apperror.Internal("failed to apply deposit", err)
				}
			}
			if record.OrderID != nil {
				if err := s.store.UpdateOrderStatus(ctx, tx, *record.OrderID, "PREPARE"); err != nil {
					return nil, apperror.Internal("failed to update order after payment", err)
				}
				order, err := s.store.GetAdminOrderByID(ctx, *record.OrderID)
				if err == nil && order.FulfillmentMode == "rider_delivery" && order.DeliveryJob == nil {
					if _, err := s.store.CreateDeliveryJob(ctx, tx, order.ID, order.BranchID, order.DeliveryFee); err != nil {
						return nil, apperror.Internal("failed to create delivery job after payment", err)
					}
				}
			}
		case "rejected":
			if record.OrderID != nil {
				if err := s.store.UpdateOrderStatus(ctx, tx, *record.OrderID, "REJECTED"); err != nil {
					return nil, apperror.Internal("failed to reject order after payment failure", err)
				}
				if err := s.store.CancelDeliveryJobByOrderID(ctx, tx, *record.OrderID, webhook.FailedReason); err != nil {
					return nil, apperror.Internal("failed to cancel delivery job after payment failure", err)
				}
			}
		}
	}

	if err := s.store.UpdatePaymentWebhookEventStatus(ctx, tx, eventID, "processed", nil); err != nil {
		return nil, apperror.Internal("failed to mark webhook event processed", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperror.Internal("failed to commit webhook handling", err)
	}
	return map[string]any{
		"processed":         true,
		"transactionId":     record.TransactionID,
		"providerReference": webhook.ProviderReference,
		"status":            webhook.Status,
		"providerStatus":    webhook.ProviderStatus,
	}, nil
}

func (s *PaymentService) verifySlip(
	ctx context.Context,
	transaction model.TransactionSummary,
	fileName string,
	fileContents []byte,
) (repository.SlipUpdateParams, error) {
	if strings.ToUpper(s.config.SlipOKMode) == "LOCAL" || strings.TrimSpace(s.config.SlipOKVerifyURL) == "" {
		now := time.Now()
		slipDate := now
		slipTimestamp := now
		return repository.SlipUpdateParams{
			TransactionID: transaction.ID,
			Reference:     fmt.Sprintf("LOCAL-%d-%d", transaction.ID, now.Unix()),
			SlipDate:      &slipDate,
			SlipTimestamp: &slipTimestamp,
			Metadata: map[string]any{
				"mode":         "LOCAL",
				"fileName":     fileName,
				"acceptedAt":   now.Format(time.RFC3339),
				"transactionId": transaction.ID,
			},
		}, nil
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("amount", strconv.FormatFloat(transaction.Amount, 'f', 2, 64)); err != nil {
		return repository.SlipUpdateParams{}, apperror.Internal("failed to prepare slip verification request", err)
	}
	part, err := writer.CreateFormFile("files", fileName)
	if err != nil {
		return repository.SlipUpdateParams{}, apperror.Internal("failed to prepare slip verification file", err)
	}
	if _, err := part.Write(fileContents); err != nil {
		return repository.SlipUpdateParams{}, apperror.Internal("failed to prepare slip verification file", err)
	}
	if err := writer.Close(); err != nil {
		return repository.SlipUpdateParams{}, apperror.Internal("failed to finalize slip verification request", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, s.config.SlipOKVerifyURL, &body)
	if err != nil {
		return repository.SlipUpdateParams{}, apperror.Internal("failed to create slip verification request", err)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if token := strings.TrimSpace(s.config.SlipOKToken); token != "" {
		request.Header.Set("x-authorization", token)
	}

	response, err := s.httpClient.Do(request)
	if err != nil {
		return repository.SlipUpdateParams{}, apperror.BadRequest("unable to verify slip")
	}
	defer response.Body.Close()

	payloadBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return repository.SlipUpdateParams{}, apperror.BadRequest("unable to read slip verification response")
	}
	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return repository.SlipUpdateParams{}, apperror.BadRequest("unable to decode slip verification response")
	}

	success := lookupBool(payload, "success") || lookupNestedBool(payload, "data", "success")
	if !success {
		return repository.SlipUpdateParams{}, apperror.BadRequest(resolveSlipErrorMessage(payload))
	}

	now := time.Now()
	reference := lookupNestedString(payload, "data", "transRef")
	if reference == "" {
		reference = lookupString(payload, "transRef")
	}
	slipDate := parseFlexibleDate(lookupNestedString(payload, "data", "transDate"))
	slipTimestamp := parseFlexibleTime(lookupNestedString(payload, "data", "transTimestamp"))
	if slipDate == nil {
		slipDate = &now
	}
	if slipTimestamp == nil {
		slipTimestamp = &now
	}

	return repository.SlipUpdateParams{
		TransactionID: transaction.ID,
		Reference:     reference,
		SlipDate:      slipDate,
		SlipTimestamp: slipTimestamp,
		Metadata:      payload,
	}, nil
}

func lookupString(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok {
		return ""
	}
	text, _ := value.(string)
	return text
}

func lookupNestedString(payload map[string]any, parent string, key string) string {
	raw, ok := payload[parent]
	if !ok {
		return ""
	}
	child, ok := raw.(map[string]any)
	if !ok {
		return ""
	}
	text, _ := child[key].(string)
	return text
}

func lookupBool(payload map[string]any, key string) bool {
	value, ok := payload[key]
	if !ok {
		return false
	}
	flag, _ := value.(bool)
	return flag
}

func lookupNestedBool(payload map[string]any, parent string, key string) bool {
	raw, ok := payload[parent]
	if !ok {
		return false
	}
	child, ok := raw.(map[string]any)
	if !ok {
		return false
	}
	flag, _ := child[key].(bool)
	return flag
}

func resolveSlipErrorMessage(payload map[string]any) string {
	if code, ok := payload["code"].(float64); ok {
		switch int(code) {
		case 1013:
			return "slip amount does not match the transaction amount"
		case 1000:
			return "slip data is incomplete"
		}
	}
	if message, ok := payload["message"].(string); ok && message != "" {
		return message
	}
	if message := lookupNestedString(payload, "data", "message"); message != "" {
		return message
	}
	return "slip verification failed"
}

func parseFlexibleDate(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{"2006-01-02", time.RFC3339, "2006-01-02 15:04:05"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return &parsed
		}
	}
	return nil
}

func parseFlexibleTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return &parsed
		}
	}
	return nil
}

func buildManualPaymentAction(method model.PaymentMethod, amount float64, expiresAt time.Time) map[string]any {
	action := map[string]any{
		"type":         "manual_qr",
		"checkoutFlow": method.CheckoutFlow,
		"amount":       amount,
		"currency":     "THB",
		"expiresAt":    expiresAt.Format(time.RFC3339),
	}
	if method.PromptPayID != nil {
		action["promptPayId"] = *method.PromptPayID
	}
	if method.ProviderCode != nil {
		action["provider"] = *method.ProviderCode
	}
	return action
}
