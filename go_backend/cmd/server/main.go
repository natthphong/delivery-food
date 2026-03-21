package main

import (
	"context"
	"log"
	"net/http"
	"time"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/db"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
	backendserver "github.com/natthaohong/delivery-food/go_backend/internal/server"
	"github.com/natthaohong/delivery-food/go_backend/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.OpenPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer pool.Close()

	if cfg.AutoMigrate {
		if err := db.RunMigrations(ctx, pool, cfg.MigrationDir); err != nil {
			log.Fatalf("run migrations: %v", err)
		}
	}

	store := repository.New(pool)
	tokenManager := backendauth.NewTokenManager(cfg.JWTSecret)
	verifier := backendauth.NewFirebaseLookupVerifier(cfg.FirebaseAPIKey, cfg.HTTPClientTimeout)

	services := backendserver.Services{
		Auth:      service.NewAuthService(store, verifier, tokenManager, cfg.AccessTokenTTL, cfg.RefreshTokenTTL),
		AdminAuth: service.NewAdminAuthService(store, cfg, tokenManager, cfg.AccessTokenTTL, cfg.RefreshTokenTTL),
		Operations: service.NewOperationsService(store),
		App:       service.NewAppService(store),
		Catalog:   service.NewCatalogService(store),
		Cart:      service.NewCartService(store),
		Payment:   service.NewPaymentService(store, cfg),
	}

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           backendserver.NewRouter(cfg, tokenManager, services),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("delivery backend listening on :%s", cfg.Port)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}
