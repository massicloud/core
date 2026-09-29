package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	APIPort        string
	APIBaseURL     string // e.g. http://localhost:8080 — used to build download token URLs
	PublicHost     string
	DomainSuffix   string // ingress DNS suffix for tenant workloads, e.g. "massicloud.work"
	StorageClass   string // k8s StorageClass for tenant PVCs, e.g. "local-path"
	DatabaseURL    string
	JWTSecret      string
	RegisterSecret string
	TokenExpiry    time.Duration
	MinioEndpoint  string
	MinioUser      string
	MinioPassword  string
	MinioUseSSL    bool

	// RedisURL is the platform rate limiter's primary store
	// (redis://:{password}@{host}:{port}/{db}). Optional — when empty, the
	// rate limiter runs in-memory-only from the start, with no attempt to
	// reach Redis. See internal/ratelimit.
	RedisURL string

	// Backing-service images used when provisioning tenant workloads on k8s.
	PostgresImage  string
	RedisImage     string
	PostgRESTImage string
	MongoImage     string
}

func Load() (*Config, error) {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	publicHost := os.Getenv("PUBLIC_HOST")
	if publicHost == "" {
		publicHost = "localhost"
	}

	domainSuffix := os.Getenv("DOMAIN_SUFFIX")
	if domainSuffix == "" {
		domainSuffix = "massicloud.work"
	}

	storageClass := os.Getenv("STORAGE_CLASS")
	if storageClass == "" {
		storageClass = "local-path"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required (e.g. postgres://user:pass@host:5432/db)")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET is required")
	}
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("config: JWT_SECRET must be at least 32 chars")
	}

	registerSecret := os.Getenv("REGISTER_SECRET")
	if registerSecret == "" {
		return nil, fmt.Errorf("config: REGISTER_SECRET is required")
	}

	tokenExpiryHours := 168 // 7 days
	if h := os.Getenv("TOKEN_EXPIRY_HOURS"); h != "" {
		if parsed, err := strconv.Atoi(h); err == nil && parsed > 0 {
			tokenExpiryHours = parsed
		}
	}

	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	}

	minioUser := os.Getenv("MINIO_USER")
	if minioUser == "" {
		return nil, fmt.Errorf("config: MINIO_USER is required")
	}

	minioPassword := os.Getenv("MINIO_PASSWORD")
	if minioPassword == "" {
		return nil, fmt.Errorf("config: MINIO_PASSWORD is required")
	}

	minioUseSSL := os.Getenv("MINIO_USE_SSL") == "true"

	redisURL := os.Getenv("REDIS_URL")

	postgresImage := os.Getenv("POSTGRES_IMAGE")
	if postgresImage == "" {
		postgresImage = "postgres:16-alpine"
	}
	redisImage := os.Getenv("REDIS_IMAGE")
	if redisImage == "" {
		redisImage = "redis:7-alpine"
	}
	postgrestImage := os.Getenv("POSTGREST_IMAGE")
	if postgrestImage == "" {
		postgrestImage = "postgrest/postgrest:v12.2.3"
	}
	mongoImage := os.Getenv("MONGO_IMAGE")
	if mongoImage == "" {
		mongoImage = "percona/percona-server-mongodb:7.0"
	}

	apiBaseURL := os.Getenv("API_BASE_URL")
	if apiBaseURL == "" {
		apiBaseURL = fmt.Sprintf("http://%s:%s", publicHost, port)
	}

	return &Config{
		APIPort:        port,
		APIBaseURL:     apiBaseURL,
		PublicHost:     publicHost,
		DomainSuffix:   domainSuffix,
		StorageClass:   storageClass,
		DatabaseURL:    databaseURL,
		JWTSecret:      jwtSecret,
		RegisterSecret: registerSecret,
		TokenExpiry:    time.Duration(tokenExpiryHours) * time.Hour,
		MinioEndpoint:  minioEndpoint,
		MinioUser:      minioUser,
		MinioPassword:  minioPassword,
		MinioUseSSL:    minioUseSSL,
		RedisURL:       redisURL,
		PostgresImage:  postgresImage,
		RedisImage:     redisImage,
		PostgRESTImage: postgrestImage,
		MongoImage:     mongoImage,
	}, nil
}
