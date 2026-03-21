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
	Auth    *service.AuthService
	App     *service.AppService
	Catalog *service.CatalogService
	Cart    *service.CartService
	Payment *service.PaymentService
}

func NewRouter(cfg config.Config, tokenManager *backendauth.TokenManager, services Services) http.Handler {
	mux := http.NewServeMux()

	authHandler := handler.NewAuthHandler(services.Auth)
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
