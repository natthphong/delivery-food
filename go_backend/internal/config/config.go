package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env               string
	Port              string
	FrontendOrigin    string
	DatabaseURL       string
	JWTSecret         string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	AutoMigrate       bool
	MigrationDir      string
	AdminUsername     string
	AdminPassword     string
	FirebaseAPIKey    string
	SlipOKMode        string
	SlipOKVerifyURL   string
	SlipOKToken       string
	OmiseSecretKey    string
	OmisePublicKey    string
	HTTPClientTimeout time.Duration
}

func Load() (Config, error) {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	cfg := Config{
		Env:               getEnv("APP_ENV", "local"),
		Port:              getEnv("APP_PORT", "8080"),
		FrontendOrigin:    getEnv("APP_FRONTEND_ORIGIN", "http://localhost:3000"),
		JWTSecret:         getEnv("APP_JWT_SECRET", getEnv("JWT_SECRET", "")),
		AutoMigrate:       getBoolEnv("APP_AUTO_MIGRATE", true),
		MigrationDir:      getEnv("APP_MIGRATION_DIR", "../sql"),
		AdminUsername:     getEnv("ADMIN_USERNAME", ""),
		AdminPassword:     getEnv("ADMIN_PASSWORD", ""),
		FirebaseAPIKey:    getEnv("FIREBASE_API_KEY", getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "")),
		SlipOKMode:        strings.ToUpper(getEnv("SLIPOK_MODE", "LOCAL")),
		SlipOKVerifyURL:   getEnv("SLIPOK_VERIFY_URL", getEnv("NEXT_PUBLIC_SLIP_OK_VERIFY_URL", "")),
		SlipOKToken:       getEnv("SLIPOK_TOKEN", getEnv("NEXT_PUBLIC_SLIP_OK_TOKEN", "")),
		OmiseSecretKey:    getEnv("OMISE_SECRET_KEY", ""),
		OmisePublicKey:    getEnv("OMISE_PUBLIC_KEY", ""),
		HTTPClientTimeout: 20 * time.Second,
	}

	accessMinutes, err := getIntEnv("APP_ACCESS_TOKEN_TTL_MINUTES", 15)
	if err != nil {
		return Config{}, err
	}
	refreshHours, err := getIntEnv("APP_REFRESH_TOKEN_TTL_HOURS", 168)
	if err != nil {
		return Config{}, err
	}
	cfg.AccessTokenTTL = time.Duration(accessMinutes) * time.Minute
	cfg.RefreshTokenTTL = time.Duration(refreshHours) * time.Hour

	cfg.DatabaseURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = buildPostgresURL()
	}

	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("APP_JWT_SECRET or JWT_SECRET is required")
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("database configuration is required")
	}

	return cfg, nil
}

func buildPostgresURL() string {
	host := getEnv("APP_DB_HOST", getEnv("PG_HOST", "127.0.0.1"))
	port := getEnv("APP_DB_PORT", getEnv("PG_PORT", "5432"))
	user := getEnv("APP_DB_USER", getEnv("PG_USER", "postgres"))
	password := getEnv("APP_DB_PASSWORD", getEnv("PG_PASS", "postgres"))
	name := getEnv("APP_DB_NAME", getEnv("PG_NAME", "delivery_food"))
	sslMode := getEnv("APP_DB_SSLMODE", "disable")

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		user,
		password,
		host,
		port,
		name,
		sslMode,
	)
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getIntEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", key)
	}
	return parsed, nil
}

func getBoolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func loadDotEnv(path string) {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
}
