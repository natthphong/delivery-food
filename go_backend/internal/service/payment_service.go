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
}

func NewPaymentService(store *repository.Store, cfg config.Config) *PaymentService {
	return &PaymentService{
		store:      store,
		config:     cfg,
		httpClient: &http.Client{Timeout: cfg.HTTPClientTimeout},
	}
}

func (s *PaymentService) Checkout(ctx context.Context, userID int64, request dto.CheckoutRequest) (CheckoutResult, error) {
	if request.BranchID <= 0 || request.PaymentMethodID <= 0 {
		return CheckoutResult{}, apperror.BadRequest("branchId and paymentMethodId are required")
	}
	if len(request.SelectedItemIDs) == 0 {
		return CheckoutResult{}, apperror.BadRequest("selectedItemIds is required")
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
	}

	totalAmount := 0.0
	for _, item := range items {
		totalAmount += item.LineTotal
	}
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
	})
	if err != nil {
		return CheckoutResult{}, apperror.Internal("failed to create transaction", err)
	}

	_, err = s.store.CreateOrder(ctx, tx, repository.CreateOrderParams{
		UserID:             userID,
		BranchID:           branch.ID,
		TransactionID:      transaction.ID,
		Status:             orderStatus,
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
