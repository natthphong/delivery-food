package handler

import (
	"net/http"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type CartHandler struct {
	service *service.CartService
}

func NewCartHandler(service *service.CartService) *CartHandler {
	return &CartHandler{service: service}
}

func (h *CartHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	cart, err := h.service.GetCart(r.Context(), claims.UserID)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, cart)
}

func (h *CartHandler) AddItem(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var request dto.AddCartItemRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	cart, err := h.service.AddItem(r.Context(), claims.UserID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, cart)
}

func (h *CartHandler) ItemRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/cart/items/")
	itemID, err := parsePathID(path)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}

	switch r.Method {
	case http.MethodPatch:
		var request dto.UpdateCartItemRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		cart, err := h.service.UpdateItem(r.Context(), claims.UserID, itemID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, cart)
	case http.MethodDelete:
		cart, err := h.service.RemoveItem(r.Context(), claims.UserID, itemID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, cart)
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *CartHandler) BranchRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/cart/branches/")
	branchID, err := parsePathID(path)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	if r.Method != http.MethodDelete {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	cart, err := h.service.ClearBranch(r.Context(), claims.UserID, branchID)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, cart)
}
