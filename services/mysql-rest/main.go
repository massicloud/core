package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	_ "github.com/go-sql-driver/mysql"

	"github.com/mikaminou/massicloud/services/mysql-rest/internal/auth"
	"github.com/mikaminou/massicloud/services/mysql-rest/internal/handlers"
)

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}

func newPool(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}

func main() {
	anonDSN := mustEnv("MYSQL_DSN_ANON")
	serviceDSN := mustEnv("MYSQL_DSN_SERVICE")
	jwtSecret := mustEnv("JWT_SECRET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	anonDB, err := newPool(anonDSN)
	if err != nil {
		log.Fatalf("open anon pool: %v", err)
	}
	serviceDB, err := newPool(serviceDSN)
	if err != nil {
		log.Fatalf("open service pool: %v", err)
	}

	app := handlers.New(anonDB, serviceDB)

	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(30 * time.Second))

	// Unauthenticated health check — also doubles as the readiness probe target.
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/rest", func(r chi.Router) {
		r.Use(auth.Middleware([]byte(jwtSecret)))
		r.Get("/{table}/count", app.CountRows)
		r.Get("/{table}/{id}", app.GetRow)
		r.Get("/{table}", app.ListRows)
		r.Post("/{table}", app.InsertRows)
		r.Patch("/{table}/{id}", app.UpdateRow)
		r.Delete("/{table}/{id}", app.DeleteRow)
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("massicloud-mysql-rest listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
