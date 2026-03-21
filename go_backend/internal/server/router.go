package server

import (
	"net/http"
	"strings"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/handler"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
	"github.com/natthaohong/delivery-food/go_backend/internal/middleware"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

type Services struct {
	Auth      *service.AuthService
	AdminAuth *service.AdminAuthService
	Operations *service.OperationsService
	App       *service.AppService
	Catalog   *service.CatalogService
	Cart      *service.CartService
	Payment   *service.PaymentService
}

func NewRouter(cfg config.Config, tokenManager *backendauth.TokenManager, services Services) http.Handler {
	mux := http.NewServeMux()

	authHandler := handler.NewAuthHandler(services.Auth)
	adminAuthHandler := handler.NewAdminAuthHandler(services.AdminAuth)
	operationsHandler := handler.NewOperationsHandler(services.Operations)
	appHandler := handler.NewAppHandler(services.App)
	catalogHandler := handler.NewCatalogHandler(services.Catalog)
	cartHandler := handler.NewCartHandler(services.Cart)
	paymentHandler := handler.NewPaymentHandler(services.Payment)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		httpapi.WriteOK(w, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /v1/auth/refresh", authHandler.Refresh)
	mux.HandleFunc("GET /v1/auth/me", middleware.RequireAuth(tokenManager, authHandler.Me))
	mux.HandleFunc("POST /v1/admin/auth/login", adminAuthHandler.Login)
	mux.HandleFunc("POST /v1/admin/auth/refresh", adminAuthHandler.Refresh)
	mux.HandleFunc("GET /v1/admin/auth/session", middleware.RequireAdminAuth(tokenManager, adminAuthHandler.Session))
	mux.HandleFunc("GET /v1/admin/dashboard", middleware.RequireAdminAuth(tokenManager, operationsHandler.Dashboard))
	mux.HandleFunc("/v1/admin/employees", middleware.RequireAdminAuth(tokenManager, operationsHandler.Employees))
	mux.HandleFunc("/v1/admin/employees/", middleware.RequireAdminAuth(tokenManager, operationsHandler.EmployeeRoutes))
	mux.HandleFunc("GET /v1/admin/attendance", middleware.RequireAdminAuth(tokenManager, operationsHandler.Attendance))
	mux.HandleFunc("POST /v1/admin/attendance/clock-in", middleware.RequireAdminAuth(tokenManager, operationsHandler.ClockIn))
	mux.HandleFunc("POST /v1/admin/attendance/clock-out", middleware.RequireAdminAuth(tokenManager, operationsHandler.ClockOut))
	mux.HandleFunc("/v1/admin/attendance/", middleware.RequireAdminAuth(tokenManager, operationsHandler.AttendanceRoutes))
	mux.HandleFunc("/v1/admin/ot-requests", middleware.RequireAdminAuth(tokenManager, operationsHandler.OTRequests))
	mux.HandleFunc("/v1/admin/ot-requests/", middleware.RequireAdminAuth(tokenManager, operationsHandler.OTRequestRoutes))
	mux.HandleFunc("/v1/admin/payroll/settings", middleware.RequireAdminAuth(tokenManager, operationsHandler.PayrollSettings))
	mux.HandleFunc("/v1/admin/payroll/periods", middleware.RequireAdminAuth(tokenManager, operationsHandler.PayrollPeriods))
	mux.HandleFunc("/v1/admin/payroll/periods/", middleware.RequireAdminAuth(tokenManager, operationsHandler.PayrollPeriodRoutes))
	mux.HandleFunc("/v1/admin/branches", middleware.RequireAdminAuth(tokenManager, operationsHandler.Branches))
	mux.HandleFunc("/v1/admin/branches/", middleware.RequireAdminAuth(tokenManager, operationsHandler.BranchRoutes))
	mux.HandleFunc("/v1/admin/orders", middleware.RequireAdminAuth(tokenManager, operationsHandler.Orders))
	mux.HandleFunc("/v1/admin/orders/", middleware.RequireAdminAuth(tokenManager, operationsHandler.OrderRoutes))
	mux.HandleFunc("/v1/admin/rider/jobs", middleware.RequireAdminAuth(tokenManager, operationsHandler.RiderJobs))
	mux.HandleFunc("/v1/admin/rider/jobs/", middleware.RequireAdminAuth(tokenManager, operationsHandler.RiderJobRoutes))
	mux.HandleFunc("/v1/admin/payments", middleware.RequireAdminAuth(tokenManager, operationsHandler.Payments))
	mux.HandleFunc("/v1/admin/payments/providers", middleware.RequireAdminAuth(tokenManager, operationsHandler.PaymentProviders))
	mux.HandleFunc("/v1/admin/payments/webhooks", middleware.RequireAdminAuth(tokenManager, operationsHandler.PaymentWebhooks))
	mux.HandleFunc("GET /v1/bootstrap", middleware.RequireAuth(tokenManager, appHandler.Bootstrap))
	mux.HandleFunc("PATCH /v1/account/profile", middleware.RequireAuth(tokenManager, appHandler.UpdateProfile))
	mux.HandleFunc("GET /v1/account/transactions", middleware.RequireAuth(tokenManager, appHandler.Transactions))
	mux.HandleFunc("GET /v1/account/orders", middleware.RequireAuth(tokenManager, appHandler.Orders))
	mux.HandleFunc("GET /v1/catalog/search", catalogHandler.Search)
	mux.HandleFunc("GET /v1/catalog/branches/", catalogHandler.BranchRoutes)
	mux.HandleFunc("GET /v1/payment-methods", catalogHandler.PaymentMethods)
	mux.HandleFunc("GET /v1/cart", middleware.RequireAuth(tokenManager, cartHandler.Get))
	mux.HandleFunc("POST /v1/cart/items", middleware.RequireAuth(tokenManager, cartHandler.AddItem))
	mux.HandleFunc("/v1/cart/items/", middleware.RequireAuth(tokenManager, cartHandler.ItemRoutes))
	mux.HandleFunc("/v1/cart/branches/", middleware.RequireAuth(tokenManager, cartHandler.BranchRoutes))
	mux.HandleFunc("POST /v1/checkout", middleware.RequireAuth(tokenManager, paymentHandler.Checkout))
	mux.HandleFunc("POST /v1/deposits", middleware.RequireAuth(tokenManager, paymentHandler.Deposit))
	mux.HandleFunc("POST /v1/payments/webhooks/omise", paymentHandler.WebhookOmise)
	mux.HandleFunc("/v1/transactions/", middleware.RequireAuth(tokenManager, paymentHandler.TransactionRoutes))

	return withCORS(cfg, mux)
}

func withCORS(cfg config.Config, next http.Handler) http.Handler {
	allowedOrigin := strings.TrimSpace(cfg.FrontendOrigin)
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if allowedOrigin == "*" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if allowedOrigin != "*" {
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
