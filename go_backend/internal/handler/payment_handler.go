package handler

import (
	"io"
	"net/http"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type PaymentHandler struct {
	service *service.PaymentService
}

func NewPaymentHandler(service *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{service: service}
}

func (h *PaymentHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var request dto.CheckoutRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	result, err := h.service.Checkout(r.Context(), claims.UserID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *PaymentHandler) Deposit(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var request dto.DepositRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	result, err := h.service.CreateDeposit(r.Context(), claims.UserID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *PaymentHandler) WebhookOmise(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		httpapi.WriteError(w, apperror.BadRequest("unable to read webhook payload"))
		return
	}
	result, err := h.service.HandleOmiseWebhook(r.Context(), r.Header, payload)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *PaymentHandler) TransactionRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/transactions/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	transactionID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}

	switch {
	case r.Method == http.MethodGet && len(parts) == 1:
		result, err := h.service.GetTransactionDetail(r.Context(), claims.UserID, transactionID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "retry":
		var request dto.RetryPaymentRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		result, err := h.service.RetryPayment(r.Context(), claims.UserID, transactionID, request.PaymentMethodID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "slip":
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			httpapi.WriteError(w, apperror.BadRequest("invalid multipart payload"))
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			file, header, err = r.FormFile("qrFile")
		}
		if err != nil {
			httpapi.WriteError(w, apperror.BadRequest("slip file is required"))
			return
		}
		defer file.Close()
		payload, err := io.ReadAll(file)
		if err != nil {
			httpapi.WriteError(w, apperror.BadRequest("unable to read slip file"))
			return
		}
		result, err := h.service.SubmitSlip(r.Context(), claims.UserID, transactionID, header.Filename, payload)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}
