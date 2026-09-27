package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/mikaminou/massicloud/api/internal/auth"
	"github.com/mikaminou/massicloud/api/internal/backup"
	"github.com/mikaminou/massicloud/api/internal/config"
	"github.com/mikaminou/massicloud/api/internal/handlers"
	"github.com/mikaminou/massicloud/api/internal/initschemas"
	"github.com/mikaminou/massicloud/api/internal/k8s"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/proxy"
	"github.com/mikaminou/massicloud/api/internal/storage"
	"github.com/mikaminou/massicloud/api/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := godotenv.Load(); err != nil {
		slog.Info("no .env file found, using environment variables")
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Initialize store
	storeCtx, storeCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer storeCancel()

	db, err := store.New(storeCtx, cfg.DatabaseURL, logger)
	if err != nil {
		slog.Error("failed to initialize store", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("store initialized")

	if err := db.LogInstancesWithInvalidNames(context.Background()); err != nil {
		slog.Error("failed to check instance names", "error", err)
	}

	// Initialize auth service
	authSvc := auth.New(db, cfg, logger)
	slog.Info("auth service initialized")

	// Initialize storage client
	storageClient, err := storage.New(cfg, logger)
	if err != nil {
		slog.Error("failed to initialize storage", "error", err)
		os.Exit(1)
	}
	slog.Info("storage client initialized")

	// Initialize Kubernetes client (tenant provisioning)
	k8sClient, err := k8s.New(logger, k8s.Config{
		DomainSuffix:   cfg.DomainSuffix,
		StorageClass:   cfg.StorageClass,
		PostgresImage:  cfg.PostgresImage,
		RedisImage:     cfg.RedisImage,
		PostgRESTImage: cfg.PostgRESTImage,
		MongoImage:     cfg.MongoImage,
	})
	if err != nil {
		slog.Error("failed to initialize k8s client", "error", err)
		os.Exit(1)
	}
	slog.Info("k8s client initialized")

	// Initialize DB proxy and init-schemas service
	dbProxy := proxy.New(db)
	initSvc := initschemas.New(dbProxy, logger)
	slog.Info("init schemas service initialized")

	// Initialize backup service
	backupSvc := backup.New(db, storageClient, logger)
	if err := backupSvc.EnsureBucket(context.Background()); err != nil {
		slog.Error("failed to ensure backup bucket", "error", err)
		os.Exit(1)
	}
	slog.Info("backup service initialized")

	// Start backup scheduler
	scheduler := backup.NewScheduler(backupSvc, db, logger)
	schedulerCtx, schedulerCancel := context.WithCancel(context.Background())
	go scheduler.Run(schedulerCtx)
	slog.Info("backup scheduler started")

	// Router
	r := chi.NewRouter()
	r.Use(middleware.RequestLogger)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	// No global request timeout: every handler sets its own via
	// context.WithTimeout, sized to what it actually does (a few seconds for
	// reads, minutes for tenant provisioning that waits on k8s StatefulSet/
	// Deployment readiness). A blanket 30s here was silently capping ALL of
	// them — including the 60s CreateStage/AddInstanceToStage timeouts,
	// since a context's effective deadline is always the earliest one in its
	// chain. That's exactly why tenant instance creation (which can
	// legitimately take 2-4 minutes on first boot) always failed: the
	// request got killed at 30s no matter what the handler asked for.

	// CORS middleware. The portal's production origin is derived from
	// cfg.DomainSuffix (not hardcoded) so this can't silently drift from
	// wherever the portal is actually deployed — a Traefik-level CORS
	// middleware also exists in the Helm chart, but this is the one that
	// actually matters if that layer isn't in effect for any reason, so it
	// must independently allow the real production origin rather than only
	// localhost dev ports.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002",
			"http://localhost:3003",
			"http://localhost:3004",
			"http://localhost:3005",
			"http://localhost:3030",
			fmt.Sprintf("https://app.%s", cfg.DomainSuffix),
		},
		AllowedMethods: []string{
			"GET", "POST", "PUT", "PATCH",
			"DELETE", "OPTIONS",
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-Request-ID",
			"X-MassiCloud-Key",
			"apikey",
		},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	h := handlers.New(k8sClient, logger, cfg, db, authSvc, storageClient, initSvc, backupSvc, dbProxy)

	// Public routes — no auth required
	r.Get("/health", h.Health)
	r.Post("/auth/login", h.Login)
	r.Get("/storage/download", h.DownloadViaToken)
	r.Post("/auth/register", h.Register)

	// Schema presets — no auth required
	r.Get("/schema-presets", h.ListPresets)

	// Protected routes — platform JWT required
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(authSvc))

		// Auth
		r.Get("/auth/me", h.Me)

		// Projects
		r.Route("/projects", func(r chi.Router) {
			r.Post("/", h.CreateProject)
			r.Get("/", h.ListProjects)
			r.Get("/{id}", h.GetProject)
			r.Delete("/{id}", h.DeleteProject)

			// API key management
			r.Get("/{id}/keys", h.ListAPIKeys)
			r.Post("/{id}/keys/{type}/rotate", h.RotateAPIKey)

			// Stage management
			r.Get("/{id}/stages", h.ListStages)
			r.Post("/{id}/stages", h.CreateStage)
			r.Delete("/{id}/stages/{stage_name}", h.DeleteStage)
			r.Patch("/{id}/stages/{stage_name}/protected", h.SetStageProtected)

			// Instance management within a stage
			r.Get("/{id}/stages/{stage_name}/instances", h.ListInstancesForStage)
			r.Post("/{id}/stages/{stage_name}/instances", h.AddInstanceToStage)
			r.Delete("/{id}/stages/{stage_name}/instances/{instance_name}", h.DeleteInstanceFromStage)
		})

		// Postgres management (scoped to project via query param)
		r.Route("/postgres", func(r chi.Router) {
			r.Get("/", h.ListPostgres)
			r.Delete("/{id}", h.DeletePostgres)

			// Database explorer routes
			r.Get("/{id}/connection", h.GetConnection)
			r.Get("/{id}/schemas", h.GetSchemas)
			r.Get("/{id}/schema/tables-with-columns", h.GetTablesWithColumns)
			r.Route("/{id}/schema", func(r chi.Router) {
				r.Route("/tables", func(r chi.Router) {
					r.Get("/", h.GetTables)
					r.Post("/", h.CreateTable)
					r.Route("/{table}", func(r chi.Router) {
						r.Delete("/", h.DeleteTable)
						r.Post("/truncate", h.TruncateTable)
						r.Post("/rls", h.EnableRLS)
						r.Route("/columns", func(r chi.Router) {
							r.Get("/", h.GetColumns)
							r.Post("/", h.AddColumn)
							r.Patch("/{column}", h.AlterColumn)
							r.Delete("/{column}", h.DeleteColumn)
						})
						r.Route("/indexes", func(r chi.Router) {
							r.Get("/", h.GetIndexes)
							r.Post("/", h.CreateIndex)
							r.Delete("/{index}", h.DeleteIndex)
						})
						r.Route("/foreign-keys", func(r chi.Router) {
							r.Get("/", h.GetForeignKeys)
							r.Post("/", h.AddForeignKey)
							r.Delete("/{fk}", h.DeleteForeignKey)
						})
					})
				})
			})
			r.Route("/{id}/tables/{table}", func(r chi.Router) {
				r.Route("/rows", func(r chi.Router) {
					r.Get("/", h.GetRows)
					r.Post("/", h.InsertRow)
					r.Put("/{pk}", h.UpdateRow)
					r.Delete("/{pk}", h.DeleteRow)
					r.Post("/bulk-delete", h.BulkDeleteRows)
				})
			})
			r.Post("/{id}/query", h.RunQuery)
			r.Post("/{id}/reload-schema", h.ReloadSchema)
			r.Get("/{id}/export/schema", h.ExportSchema)
			r.Get("/{id}/export/full", h.ExportFull)
			r.Post("/{id}/initialize", h.InitializePostgres)

			// Backup routes
			r.Route("/{id}/backups", func(r chi.Router) {
				r.Post("/", h.CreateBackup)
				r.Get("/", h.ListBackups)
				r.Delete("/{backup_id}", h.DeleteBackup)
				r.Post("/{backup_id}/restore", h.RestoreBackup)
			})
			r.Put("/{id}/backup-settings", h.UpdateBackupSettings)
		})

		// Redis management (scoped to project via query param)
		r.Route("/redis", func(r chi.Router) {
			r.Get("/", h.ListRedis)
			r.Delete("/{id}", h.DeleteRedis)
		})

		// Mongo management (scoped to project via query param)
		r.Route("/mongo", func(r chi.Router) {
			r.Get("/", h.ListMongo)
			r.Delete("/{id}", h.DeleteMongo)

			r.Route("/{id}/collections", func(r chi.Router) {
				r.Get("/", h.GetMongoCollections)
				r.Post("/", h.CreateMongoCollection)
				r.Route("/{name}", func(r chi.Router) {
					r.Delete("/", h.DeleteMongoCollection)
					r.Route("/documents", func(r chi.Router) {
						r.Get("/", h.GetMongoDocuments)
						r.Post("/", h.InsertMongoDocument)
						r.Patch("/{docId}", h.UpdateMongoDocument)
						r.Delete("/{docId}", h.DeleteMongoDocument)
					})
					r.Route("/indexes", func(r chi.Router) {
						r.Get("/", h.GetMongoIndexes)
						r.Post("/", h.CreateMongoIndex)
						r.Delete("/{indexName}", h.DeleteMongoIndex)
					})
				})
			})
			r.Post("/{id}/query", h.RunMongoQuery)
		})

		// Storage — buckets and objects
		r.Route("/storage/buckets", func(r chi.Router) {
			r.Post("/", h.CreateBucket)
			r.Get("/", h.ListBuckets)
			r.Delete("/{name}", h.DeleteBucket)
			r.Patch("/{name}", h.RenameBucket)
			r.Put("/{name}/policy", h.UpdateBucketPolicy)

			r.Get("/{name}/objects", h.ListObjects)
			r.Post("/{name}/objects", h.UploadObject)
			r.Get("/{name}/objects/*", h.DownloadObject)
			r.Delete("/{name}/objects/*", h.DeleteObject)
			r.Post("/{name}/presign", h.PresignObject)
		})
	})

	// Project-scoped public routes — gated by project API key, not platform JWT.
	r.Route("/v1/{slug}", func(r chi.Router) {
		r.Use(middleware.RequireProjectKey(db, logger))

		// Old v1 routes without stage — return 410 Gone.
		r.Post("/auth/signup", gone("/v1/{slug}/{stage}/db/{db}/auth/signup"))
		r.Post("/auth/login", gone("/v1/{slug}/{stage}/db/{db}/auth/login"))
		r.Post("/auth/refresh", gone("/v1/{slug}/{stage}/db/{db}/auth/refresh"))
		r.Get("/auth/user", gone("/v1/{slug}/{stage}/db/{db}/auth/user"))
		r.HandleFunc("/rest/*", gone("/v1/{slug}/{stage}/db/{db}/rest/{table}"))
		r.HandleFunc("/rest", gone("/v1/{slug}/{stage}/db/{db}/rest/{table}"))

		// Old DB-scoped routes without stage param — return 410 Gone.
		r.HandleFunc("/db/{db}/*", gone("/v1/{slug}/{stage}/db/{db}/..."))
		r.HandleFunc("/db/{db}", gone("/v1/{slug}/{stage}/db/{db}/..."))

		// Stage-scoped routes: /v1/{slug}/{stage}/db/{db}/...
		r.Route("/{stage}", func(r chi.Router) {
			r.Use(middleware.RequireProjectStage(db))

			r.Route("/db/{db}", func(r chi.Router) {
				r.Use(middleware.RequireStageInstance(db))

				r.Post("/auth/signup", h.SignUpEndUser)
				r.Post("/auth/login", h.SignInEndUser)
				r.Post("/auth/refresh", h.RefreshEndUser)

				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireEndUserToken)
					r.Get("/auth/user", h.GetEndUser)
				})

				// ProxyREST doesn't set its own context timeout (it streams
				// through to PostgREST), so it needs an explicit one now
				// that there's no global default to fall back on.
				r.With(chimiddleware.Timeout(30*time.Second)).HandleFunc("/rest/*", h.ProxyREST)
				r.With(chimiddleware.Timeout(30*time.Second)).HandleFunc("/rest", h.ProxyREST)

				// Admin SQL endpoint for migration tools (dbmate, Sqitch,
				// Prisma, sqlc, plain psql scripts) — service key only.
				// 60s timeout so a real migration doesn't die at 30s; rate
				// limited since a single query can peg tenant Postgres.
				r.With(
					chimiddleware.Timeout(60*time.Second),
					middleware.RateLimitPerProject(10),
					middleware.MaxBytes(1<<20), // 1MB
				).Post("/query", h.AdminQuery)
			})
		})

		// Storage — project-scoped, not stage/db-scoped (buckets aren't tied
		// to a database). Reads are allowed on public buckets with just the
		// API key; private buckets and all writes need an end-user session.
		r.Route("/storage/buckets/{name}", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.OptionalEndUserToken)
				r.Get("/objects", h.EndUserListObjects)
				r.Get("/objects/*", h.EndUserDownloadObject)
				r.Post("/presign", h.EndUserPresignObject)
			})

			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireEndUserToken)
				r.Post("/objects", h.EndUserUploadObject)
				r.Delete("/objects/*", h.EndUserDeleteObject)
			})
		})
	})

	// HTTP server with timeouts
	srv := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("massicloud api starting", "port", cfg.APIPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-stop
	slog.Info("shutting down gracefully...")

	schedulerCancel()
	scheduler.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced shutdown", "error", err)
	}

	slog.Info("massicloud api stopped")
}

// gone returns a handler that responds 410 Gone, pointing clients at the new URL pattern.
func gone(newURLPattern string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusGone)
		json.NewEncoder(w).Encode(map[string]string{
			"error":           "this URL has moved",
			"new_url_pattern": newURLPattern,
			"migration":       "Update your client to include the stage name in the URL path.",
		})
	}
}
