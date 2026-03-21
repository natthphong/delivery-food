package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type CatalogHandler struct {
	service *service.CatalogService
}

func NewCatalogHandler(service *service.CatalogService) *CatalogHandler {
	return &CatalogHandler{service: service}
}

func (h *CatalogHandler) Search(w http.ResponseWriter, r *http.Request) {
	categoryID, err := parseQueryInt64(r.URL.Query().Get("categoryId"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	lat, err := parseQueryFloat64(r.URL.Query().Get("lat"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	lng, err := parseQueryFloat64(r.URL.Query().Get("lng"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	result, err := h.service.Search(r.Context(), r.URL.Query().Get("q"), categoryID, lat, lng)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *CatalogHandler) BranchRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v1/catalog/branches/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	branchID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}

	switch {
	case r.Method == http.MethodGet && parts[1] == "menu":
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		size, _ := strconv.Atoi(r.URL.Query().Get("size"))
		result, err := h.service.BranchMenu(r.Context(), branchID, r.URL.Query().Get("q"), page, size)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	case r.Method == http.MethodGet && parts[1] == "featured":
		result, err := h.service.FeaturedMenu(r.Context(), branchID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *CatalogHandler) PaymentMethods(w http.ResponseWriter, r *http.Request) {
	companyID, err := parseQueryInt64(r.URL.Query().Get("companyId"))
	if err != nil || companyID == nil {
		httpapi.WriteError(w, apperror.BadRequest("companyId is required"))
		return
	}
	items, err := h.service.PaymentMethods(r.Context(), *companyID, r.URL.Query().Get("scope"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"methods": items})
}
