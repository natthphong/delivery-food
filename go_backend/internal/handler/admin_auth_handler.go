package handler

import (
	"net/http"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type AdminAuthHandler struct {
	service *service.AdminAuthService
}

func NewAdminAuthHandler(service *service.AdminAuthService) *AdminAuthHandler {
	return &AdminAuthHandler{service: service}
}

func (h *AdminAuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var request dto.AdminLoginRequest
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

func (h *AdminAuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var request dto.AdminRefreshRequest
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

func (h *AdminAuthHandler) Session(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	response, err := h.service.Session(r.Context(), claims)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"session": response})
}

func ClaimsFromRequest(r *http.Request) (*backendauth.AccessClaims, bool) {
	return middleware.ClaimsFromContext(r.Context())
}
