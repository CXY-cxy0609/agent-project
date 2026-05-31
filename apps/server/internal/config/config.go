package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	GRPCPort    string
	NodeEnv     string
	FrontendURL string

	Auth  AuthConfig
	DB    DBConfig
	AI    AIConfig
	Infra InfraConfig
}

type AuthConfig struct {
	JWTSecret           string
	JWTExpiresIn        string
	JWTRefreshExpiresIn string
	InternalToken       string
}

type DBConfig struct {
	Driver         string
	DSN            string
	Host           string
	Port           string
	User           string
	Password       string
	Name           string
	RepositoryMode string
	AutoMigrate    bool
}

type AIConfig struct {
	AgentServiceURL string
	RAGServiceURL   string
}

type InfraConfig struct {
	RedisAddr     string
	RedisUsername string
	RedisPwd      string
	KafkaBrokers  string
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		log.Printf("config: .env not loaded (%v), using env only", err)
	}

	return Config{
		Port:        getEnv("PORT", "3000"),
		GRPCPort:    getEnv("GRPC_PORT", "50051"),
		NodeEnv:     getEnv("NODE_ENV", "development"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
		Auth: AuthConfig{
			JWTSecret:           getEnv("JWT_SECRET", "change-me"),
			JWTExpiresIn:        getEnv("JWT_EXPIRES_IN", "7d"),
			JWTRefreshExpiresIn: getEnv("JWT_REFRESH_EXPIRES_IN", "30d"),
			InternalToken:       getEnv("INTERNAL_TOKEN", ""),
		},
		DB: DBConfig{
			// 兼容旧配置：未显式声明时，继续用 mysql。
			Driver:         getEnv("DB_DRIVER", "mysql"),
			DSN:            getEnv("DB_DSN", ""),
			Host:           getEnv("DB_HOST", "localhost"),
			Port:           getEnv("DB_PORT", "3306"),
			User:           getEnv("DB_USERNAME", "root"),
			Password:       getEnv("DB_PASSWORD", ""),
			Name:           getEnv("DB_NAME", "tutor_db"),
			RepositoryMode: getEnv("DB_REPOSITORY_MODE", "memory"),
			AutoMigrate:    getEnvBool("DB_AUTO_MIGRATE", false),
		},
		AI: AIConfig{
			AgentServiceURL: getEnv("AGENT_SERVICE_URL", "http://localhost:8001"),
			RAGServiceURL:   getEnv("RAG_SERVICE_URL", "http://localhost:8000"),
		},
		Infra: InfraConfig{
			RedisAddr:     getEnv("REDIS_ADDR", legacyRedisAddr()),
			RedisUsername: getEnv("REDIS_USERNAME", ""),
			RedisPwd:      getEnv("REDIS_PASSWORD", ""),
			KafkaBrokers:  getEnv("KAFKA_BROKERS", "localhost:9092"),
		},
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func legacyRedisAddr() string {
	host := getEnv("REDIS_HOST", "localhost")
	port := getEnv("REDIS_PORT", "6379")
	return host + ":" + port
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	switch val {
	case "1", "true", "TRUE", "yes", "YES":
		return true
	case "0", "false", "FALSE", "no", "NO":
		return false
	default:
		return fallback
	}
}
