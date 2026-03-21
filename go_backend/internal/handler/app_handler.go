package handler

import (
	"io"
	"net/http"
	"strconv"

	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type AppHandler struct {
	service *service.AppService
}

func NewAppHandler(service *service.AppService) *AppHandler {
	return &AppHandler{service: service}
}

func (h *AppHandler) Bootstrap(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	result, err := h.service.Bootstrap(r.Context(), claims.UserID)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *AppHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var request dto.ProfilePatchRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	user, err := h.service.UpdateProfile(r.Context(), claims.UserID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"user": user})
}

func (h *AppHandler) SendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var request dto.VerificationEmailRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil && err != io.EOF {
		httpapi.WriteError(w, err)
		return
	}
	if err := h.service.SendVerificationEmail(r.Context(), claims.UserID, request.Locale); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"sent": true})
}

func (h *AppHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var request dto.VerifyEmailTokenRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	user, err := h.service.VerifyEmailToken(r.Context(), request.Token)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"user": user, "verified": true})
}

func (h *AppHandler) Transactions(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.service.ListTransactions(r.Context(), claims.UserID, limit)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"transactions": items})
}

func (h *AppHandler) Orders(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.service.ListOrders(r.Context(), claims.UserID, limit)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"orders": items})
}
