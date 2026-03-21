package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type OperationsHandler struct {
	service *service.OperationsService
}

func NewOperationsHandler(service *service.OperationsService) *OperationsHandler {
	return &OperationsHandler{service: service}
}

func (h *OperationsHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	result, err := h.service.Dashboard(r.Context(), claims)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, result)
}

func (h *OperationsHandler) Employees(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		branchID, err := parseQueryInt64(r.URL.Query().Get("branchId"))
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		items, err := h.service.ListEmployees(r.Context(), claims, r.URL.Query().Get("q"), r.URL.Query().Get("status"), branchID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"employees": items})
	case http.MethodPost:
		var request dto.EmployeeUpsertRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.UpsertEmployee(r.Context(), claims, nil, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"employee": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) EmployeeRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	employeeID, err := parsePathID(strings.TrimPrefix(r.URL.Path, "/v1/admin/employees/"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	if r.Method != http.MethodPatch {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	var request dto.EmployeeUpsertRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	item, err := h.service.UpsertEmployee(r.Context(), claims, &employeeID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"employee": item})
}

func (h *OperationsHandler) Attendance(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodGet {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	employeeID, err := parseQueryInt64(r.URL.Query().Get("employeeId"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	branchID, err := parseQueryInt64(r.URL.Query().Get("branchId"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	items, err := h.service.ListAttendance(r.Context(), claims, employeeID, branchID, r.URL.Query().Get("status"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"attendance": items})
}

func (h *OperationsHandler) ClockIn(w http.ResponseWriter, r *http.Request) {
	h.clockAction(w, r, true)
}

func (h *OperationsHandler) ClockOut(w http.ResponseWriter, r *http.Request) {
	h.clockAction(w, r, false)
}

func (h *OperationsHandler) AttendanceRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	attendanceID, err := parsePathID(strings.TrimPrefix(r.URL.Path, "/v1/admin/attendance/"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	if r.Method != http.MethodPatch {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	var request dto.AttendanceCorrectionRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	item, err := h.service.CorrectAttendance(r.Context(), claims, attendanceID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"attendance": item})
}

func (h *OperationsHandler) OTRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.ListOTRequests(r.Context(), claims, r.URL.Query().Get("status"))
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"requests": items})
	case http.MethodPost:
		var request dto.OTRequestCreate
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.CreateOTRequest(r.Context(), claims, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"request": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) OTRequestRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	requestID, err := parsePathID(strings.TrimPrefix(r.URL.Path, "/v1/admin/ot-requests/"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	if r.Method != http.MethodPatch {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	var request dto.OTReviewRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	item, err := h.service.ReviewOTRequest(r.Context(), claims, requestID, request)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"request": item})
}

func (h *OperationsHandler) PayrollSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		item, err := h.service.GetPayrollSettings(r.Context(), claims)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"settings": item})
	case http.MethodPatch:
		var request dto.PayrollSettingsUpdateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.UpdatePayrollSettings(r.Context(), claims, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"settings": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) PayrollPeriods(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.ListPayrollPeriods(r.Context(), claims)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"periods": items})
	case http.MethodPost:
		var request dto.PayrollPeriodCreateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.CreatePayrollPeriod(r.Context(), claims, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"period": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) PayrollPeriodRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/admin/payroll/periods/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	periodID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	switch {
	case r.Method == http.MethodGet && len(parts) == 1:
		result, err := h.service.GetPayrollPeriodDetail(r.Context(), claims, periodID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "generate":
		var request dto.PayrollGenerateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		result, err := h.service.GeneratePayrollPeriod(r.Context(), claims, periodID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, result)
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) Branches(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.ListBranches(r.Context(), claims)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"branches": items})
	case http.MethodPost:
		var request dto.BranchCreateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.CreateBranch(r.Context(), claims, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"branch": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) BranchRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/admin/branches/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	branchID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	switch {
	case r.Method == http.MethodPatch && len(parts) == 1:
		var request dto.BranchOperationsUpdateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.UpdateBranch(r.Context(), claims, branchID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"branch": item})
	case r.Method == http.MethodGet && len(parts) == 2 && parts[1] == "products":
		items, err := h.service.ListBranchProducts(r.Context(), claims, branchID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"products": items})
	case r.Method == http.MethodPatch && len(parts) == 3 && parts[1] == "products":
		productID, err := parsePathID(parts[2])
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		var request dto.BranchProductOperationsUpdateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		items, err := h.service.UpdateBranchProduct(r.Context(), claims, branchID, productID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"products": items})
	case r.Method == http.MethodPatch && len(parts) == 5 && parts[1] == "products" && parts[3] == "add-ons":
		productID, err := parsePathID(parts[2])
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		addOnID, err := parsePathID(parts[4])
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		var request dto.BranchProductAddOnOperationsUpdateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		items, err := h.service.UpdateBranchProductAddOn(r.Context(), claims, branchID, productID, addOnID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"products": items})
	case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "stock":
		var request dto.StockAdjustmentRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		items, err := h.service.AdjustStock(r.Context(), claims, branchID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"products": items})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) Orders(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodGet {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	items, err := h.service.ListOrders(r.Context(), claims, r.URL.Query().Get("status"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"orders": items})
}

func (h *OperationsHandler) OrderRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/admin/orders/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	orderID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	switch {
	case r.Method == http.MethodGet && len(parts) == 1:
		item, err := h.service.GetOrderDetail(r.Context(), claims, orderID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"order": item})
	case r.Method == http.MethodPatch && len(parts) == 2 && parts[1] == "status":
		var request dto.OrderStatusUpdateRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		if err := h.service.UpdateOrderStatus(r.Context(), claims, orderID, request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"updated": true})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) RiderJobs(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodGet {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	items, err := h.service.ListDeliveryJobs(r.Context(), claims, r.URL.Query().Get("status"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"jobs": items})
}

func (h *OperationsHandler) RiderJobRoutes(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	path := strings.TrimPrefix(r.URL.Path, "/v1/admin/rider/jobs/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 2 {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	jobID, err := parsePathID(parts[0])
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	switch {
	case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "claim":
		item, err := h.service.ClaimDeliveryJob(r.Context(), claims, jobID)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"job": item})
	case r.Method == http.MethodPatch && len(parts) == 2 && parts[1] == "status":
		var request dto.RiderJobStatusRequest
		if err := httpapi.DecodeJSON(r, &request); err != nil {
			httpapi.WriteError(w, err)
			return
		}
		item, err := h.service.UpdateDeliveryJobStatus(r.Context(), claims, jobID, request)
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"job": item})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) Payments(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.ListPayments(r.Context(), claims, r.URL.Query().Get("status"))
		if err != nil {
			httpapi.WriteError(w, err)
			return
		}
		httpapi.WriteOK(w, map[string]any{"payments": items})
	default:
		httpapi.WriteError(w, apperror.NotFound("route not found"))
	}
}

func (h *OperationsHandler) PaymentProviders(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodGet {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	items, err := h.service.ListPaymentProviders(r.Context(), claims)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"providers": items})
}

func (h *OperationsHandler) PaymentWebhooks(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodGet {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	items, err := h.service.ListWebhookEvents(r.Context(), claims)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"events": items})
}

func (h *OperationsHandler) clockAction(w http.ResponseWriter, r *http.Request, clockIn bool) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	if r.Method != http.MethodPost {
		httpapi.WriteError(w, apperror.NotFound("route not found"))
		return
	}
	var request dto.ClockActionRequest
	if err := httpapi.DecodeJSON(r, &request); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	var (
		item interface{}
		err  error
	)
	if clockIn {
		item, err = h.service.ClockIn(r.Context(), claims, request)
	} else {
		item, err = h.service.ClockOut(r.Context(), claims, request)
	}
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.WriteOK(w, map[string]any{"attendance": item})
}

func parseQueryInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
