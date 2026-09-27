package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

var (
	ErrPostgresInstanceNotFound = errors.New("postgres instance not found")
	ErrPostgresUnavailable      = errors.New("postgres instance unavailable")
)

// Helper to get DB connection from instance
func (h *Handler) getPostgresConnection(ctx context.Context, instanceID string) (*sql.DB, error) {
	instance, err := h.store.GetInstance(ctx, instanceID)
	if err != nil {
		h.logger.Error("failed to get instance from store",
			"id", instanceID,
			"error", err,
		)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", ErrPostgresInstanceNotFound, instanceID)
		}
		return nil, fmt.Errorf("get instance: %w", err)
	}

	// Local managed containers don't expose TLS by default.
	// Force sslmode=disable if absent to avoid lib/pq requiring SSL.
	dsn := normalizePostgresDSN(instance.DSN)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		h.logger.Error("failed to open postgres connection",
			"id", instanceID,
			"error", err,
		)
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		h.logger.Error("ping to postgres failed",
			"id", instanceID,
			"error", err,
		)
		return nil, fmt.Errorf("%w: %v", ErrPostgresUnavailable, err)
	}

	return db, nil
}

func normalizePostgresDSN(raw string) string {
	if strings.HasPrefix(raw, "postgres://") || strings.HasPrefix(raw, "postgresql://") {
		u, err := url.Parse(raw)
		if err != nil {
			return raw
		}
		q := u.Query()
		if q.Get("sslmode") == "" {
			q.Set("sslmode", "disable")
			u.RawQuery = q.Encode()
		}
		return u.String()
	}

	// key=value DSN format fallback
	if !strings.Contains(raw, "sslmode=") {
		return raw + " sslmode=disable"
	}
	return raw
}

// reloadPostgRESTSchema tells PostgREST to reload its schema cache, using the
// same connection a DDL statement just ran on. PostgREST caches the schema at
// startup and only refreshes it on this notification, so without it newly
// created tables/columns 404 until the cache happens to reload on its own.
// Failure is logged, not surfaced: the DDL itself already succeeded, and the
// reload-schema endpoint below lets a user retry manually if this is missed.
func (h *Handler) reloadPostgRESTSchema(ctx context.Context, db *sql.DB, instanceID string) {
	if _, err := db.ExecContext(ctx, "NOTIFY pgrst, 'reload schema'"); err != nil {
		h.logger.Warn("failed to notify postgrest of schema reload",
			"id", instanceID,
			"error", err,
		)
	}
}

// POST /postgres/{id}/reload-schema
func (h *Handler) ReloadSchema(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, "NOTIFY pgrst, 'reload schema'"); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to reload schema cache")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) writePostgresConnectionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPostgresInstanceNotFound):
		h.writeError(w, http.StatusNotFound, "Resource not found")
	case errors.Is(err, ErrPostgresUnavailable):
		h.writeError(w, http.StatusServiceUnavailable, "Cannot connect to MassiCloud API")
	default:
		h.writeError(w, http.StatusInternalServerError, "Server error, please try again")
	}
}

// GET /postgres/{id}/connection
func (h *Handler) GetConnection(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	var version string
	if err := db.QueryRowContext(ctx, "SELECT version()").Scan(&version); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to get version")
		return
	}

	h.writeJSON(w, http.StatusOK, ConnectionStatus{
		Connected: true,
		Version:   version,
	})
}

