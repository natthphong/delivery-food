package main

import (
	"context"
	"log"

	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/db"
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

	if err := db.RunMigrations(ctx, pool, cfg.MigrationDir); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	log.Printf("migrations applied from %s", cfg.MigrationDir)
}
