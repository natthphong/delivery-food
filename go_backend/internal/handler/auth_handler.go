package handler

import (
	"net/http"

	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type AuthHandler struct {
	service *service.AuthService
}

func NewAuthHandler(service *service.AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var request dto.AuthLoginRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	response, err := h.service.Login(r.Context(), request, r.UserAgent(), clientIP(r))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, response)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var request dto.RefreshRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	response, err := h.service.Refresh(r.Context(), request, r.UserAgent(), clientIP(r))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, response)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	user, err := h.service.Me(r.Context(), claims.UserID)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"user": user})
}
