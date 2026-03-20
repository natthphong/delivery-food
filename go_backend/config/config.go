package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Env              string
	MigrateAuto      bool
	EnableS3         bool
	Server           Server
	LogConfig        LogConfig
	DBConfig         DBConfig
	RedisConfig      RedisConfig
	HTTP             HTTP
	CORSConfig       CORSConfig
	AuthConfig       AuthConfig
	PermissionConfig map[string][]string
}

type RedisConfig struct {
	Enabled         bool
	Mode            string
	Host            string
	Port            string
	Password        string
	DB              int
	PoolTimeout     time.Duration
	DialTimeout     time.Duration
	WriteTimeout    time.Duration
	ReadTimeout     time.Duration
	ConnMaxIdleTime time.Duration
	Cluster         struct {
		Password string
		Addr     []string
	}
}

type AwsS3Config struct {
	DoSpaceEndpoint string
	DoSpaceRegion   string
	AccessKey       string
	SecretKey       string
	BucketName      string
}

type Server struct {
	Name string
	Port string
}

type LogConfig struct {
	Level string
}

type DBConfig struct {
	Host            string
	Port            string
	Username        string
	Password        string
	Name            string
	MaxOpenConn     int32
	MaxConnLifeTime int64
}

type HTTP struct {
	TimeOut            time.Duration
	MaxIdleConn        int
	MaxIdleConnPerHost int
	MaxConnPerHost     int
}

type CORSConfig struct {
	AllowOrigins     string
	AllowMethods     string
	AllowHeaders     string
	AllowCredentials bool
}

type AuthConfig struct {
	JWTSecret             string
	AccessTokenMinutes    int
	EnableMockAuth        bool
	OAuthLoginURL         string
	OAuthCallbackURL      string
	OAuthClientID         string
	OAuthClientSecret     string
	OAuthProviderAudience string
}

func InitConfig() (*Config, error) {
	loadDotEnvIfPresent(".env")
	loadDotEnvIfPresent("../.env")

	viper.SetDefault("Env", "local")
	viper.SetDefault("MigrateAuto", true)
	viper.SetDefault("LogConfig.Level", "info")
	viper.SetDefault("Server.Name", "microservice-data-panel")
	viper.SetDefault("Server.Port", "8080")
	viper.SetDefault("DBConfig.Host", "localhost")
	viper.SetDefault("DBConfig.Port", "5432")
	viper.SetDefault("DBConfig.Username", "postgres")
	viper.SetDefault("DBConfig.Password", "postgres")
	viper.SetDefault("DBConfig.Name", "postgres")
	viper.SetDefault("DBConfig.MaxOpenConn", 10)
	viper.SetDefault("DBConfig.MaxConnLifeTime", 300)
	viper.SetDefault("RedisConfig.Enabled", false)
	viper.SetDefault("RedisConfig.Mode", "normal")
	viper.SetDefault("RedisConfig.Host", "localhost")
	viper.SetDefault("RedisConfig.Port", "6379")
	viper.SetDefault("CORSConfig.AllowOrigins", "http://localhost:3000")
	viper.SetDefault("CORSConfig.AllowMethods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
	viper.SetDefault("CORSConfig.AllowHeaders", "Origin,Content-Type,Accept,Authorization,traceId")
	viper.SetDefault("CORSConfig.AllowCredentials", true)
	viper.SetDefault("AuthConfig.AccessTokenMinutes", 60)
	viper.SetDefault("AuthConfig.EnableMockAuth", false)

	configPath, ok := os.LookupEnv("API_CONFIG_PATH")
	if !ok {
		configPath = "./config"
	}
	configName, ok := os.LookupEnv("API_CONFIG_NAME")
	if !ok {
		configName = "config"
	}

	viper.SetConfigName(configName)
	viper.AddConfigPath(configPath)
	if err := viper.ReadInConfig(); err != nil {
		fmt.Println("config file not found. using default/env config: " + err.Error())
	}

	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	applyLegacyEnvMappings()

	var c Config
	if err := viper.Unmarshal(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

func InitTimeZone() {
	ict, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		panic(err)
	}
	time.Local = ict
}

func applyLegacyEnvMappings() {
	setIfEnv("PG_HOST", "DBConfig.Host")
	setIfEnv("PG_PORT", "DBConfig.Port")
	setIfEnv("PG_USER", "DBConfig.Username")
	setIfEnv("PG_PASS", "DBConfig.Password")
	setIfEnv("PG_NAME", "DBConfig.Name")
	setIfEnv("APP_PORT", "Server.Port")
	setIfEnv("LOG_LEVEL", "LogConfig.Level")
	setIfEnv("REDIS_HOST", "RedisConfig.Host")
	setIfEnv("REDIS_PORT", "RedisConfig.Port")
	setIfEnv("REDIS_PASSWORD", "RedisConfig.Password")
	setIfEnv("FRONTEND_ORIGIN", "CORSConfig.AllowOrigins")
	setIfEnv("APP_JWT_SECRET", "AuthConfig.JWTSecret")
	setIfEnv("JWT_SECRET", "AuthConfig.JWTSecret")
	setIfEnv("APP_ACCESS_TOKEN_MINUTES", "AuthConfig.AccessTokenMinutes")
	setIfEnv("APP_MOCK_AUTH_ENABLED", "AuthConfig.EnableMockAuth")
	setIfEnv("APP_ENABLE_MOCK_AUTH", "AuthConfig.EnableMockAuth")
	setIfEnv("ENABLE_MOCK_AUTH", "AuthConfig.EnableMockAuth")
	setIfEnv("MIGRATE_AUTO", "MigrateAuto")
}

func setIfEnv(envKey, viperKey string) {
	if value, ok := os.LookupEnv(envKey); ok && strings.TrimSpace(value) != "" {
		viper.Set(viperKey, value)
	}
}

func loadDotEnvIfPresent(path string) {
	resolved := filepath.Clean(path)
	f, err := os.Open(resolved)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key := ""
		value := ""
		if strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			key = strings.TrimSpace(parts[0])
			value = strings.TrimSpace(parts[1])
		} else if strings.Contains(line, ":") {
			parts := strings.SplitN(line, ":", 2)
			key = strings.TrimSpace(parts[0])
			value = strings.TrimSpace(parts[1])
		}

		if key == "" {
			continue
		}
		value = strings.Trim(value, `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
}
