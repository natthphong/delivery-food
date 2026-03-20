package main

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"gitlab.com/home-server7795544/home-server/iam/iam-backend/config"
	"gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/db"
	"gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/panel"
)

func main() {
	ctx := context.Background()
	config.InitTimeZone()

	cfg, err := config.InitConfig()
	if err != nil {
		log.Fatal("unable to initialize config")
	}

	dbPool, err := db.Open(ctx, cfg.DBConfig)
	if err != nil {
		log.Fatal(err)
	}
	defer dbPool.Close()

	engines := panel.NewEngines(dbPool)
	if cfg.MigrateAuto {
		if err := engines.Migrations.RunMigrations(ctx, filepath.Join(".", "sql")); err != nil {
			log.Fatal(err)
		}
		if err := engines.Migrations.SeedIfEmpty(ctx); err != nil {
			log.Fatal(err)
		}
	}

	app := fiber.New(fiber.Config{
		ReadTimeout:           10 * time.Second,
		WriteTimeout:          10 * time.Second,
		IdleTimeout:           30 * time.Second,
		DisableStartupMessage: true,
		CaseSensitive:         true,
		StrictRouting:         true,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSConfig.AllowOrigins,
		AllowMethods:     cfg.CORSConfig.AllowMethods,
		AllowHeaders:     cfg.CORSConfig.AllowHeaders,
		AllowCredentials: cfg.CORSConfig.AllowCredentials,
	}))

	panel.RegisterRoutes(app, engines)
	app.Get("/metric", metrics())

	log.Println("server start", "port", cfg.Server.Port)
	if err := app.Listen(fmt.Sprintf(":%s", cfg.Server.Port)); err != nil {
		log.Fatal(err)
	}
}

func metrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"code":    "SUCCESS",
			"message": "ok",
			"body": fiber.Map{
				"timestamp": strconv.FormatInt(time.Now().Unix(), 10),
			},
		})
	}
}
