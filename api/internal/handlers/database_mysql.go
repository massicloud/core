package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	_ "github.com/go-sql-driver/mysql"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

var (
	ErrMySQLInstanceNotFound = errors.New("mysql instance not found")
	ErrMySQLUnavailable      = errors.New("mysql instance unavailable")
)

// getMySQLConnection opens a fresh connection to a tenant MySQL instance's
// root DSN. Unlike Postgres, there's no long-lived pool manager here — this
// is used only for the SQL console and one-off admin queries, not for
// end-user traffic (that goes through mysql-rest).
func (h *Handler) getMySQLConnection(ctx context.Context, instanceID string) (*sql.DB, error) {
	instance, err := h.store.GetInstance(ctx, instanceID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", ErrMySQLInstanceNotFound, instanceID)
		}
		return nil, fmt.Errorf("get instance: %w", err)
	}
	if instance.Type != models.InstanceTypeMySQL {
		return nil, fmt.Errorf("%w: %s is not a mysql instance", ErrMySQLInstanceNotFound, instanceID)
	}

	db, err := sql.Open("mysql", instance.DSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("%w: %v", ErrMySQLUnavailable, err)
	}

	return db, nil
}

func (h *Handler) writeMySQLConnectionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrMySQLInstanceNotFound):
		h.writeError(w, http.StatusNotFound, "Resource not found")
	case errors.Is(err, ErrMySQLUnavailable):
		h.writeError(w, http.StatusServiceUnavailable, "Cannot connect to MassiCloud API")
	default:
		h.writeError(w, http.StatusInternalServerError, "Server error, please try again")
	}
}

// ListMySQL handles GET /mysql?project_id=X
func (h *Handler) ListMySQL(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	projectID := r.URL.Query().Get("project_id")
	if projectID == "" {
		h.writeError(w, http.StatusBadRequest, "project_id query parameter is required")
		return
	}

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied to project")
		return
	}

	allInstances, err := h.store.GetInstancesForProject(ctx, projectID)
	if err != nil {
		h.logger.Error("failed to list mysql instances", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to list databases")
		return
	}

	instances := make([]models.Instance, 0)
	for _, inst := range allInstances {
		if inst.Type == models.InstanceTypeMySQL {
			instances = append(instances, inst)
		}
	}

	h.writeJSON(w, http.StatusOK, instances)
}

// DeleteMySQL handles DELETE /mysql/{id}
func (h *Handler) DeleteMySQL(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	instance, err := h.store.GetInstance(ctx, id)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "instance not found")
		return
	}

	h.teardownInstance(ctx, instance)

	if err := h.store.DeleteInstance(ctx, id); err != nil {
		h.logger.Error("failed to delete instance from store",
			slog.String("id", id),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to delete instance record")
		return
	}

	h.logger.Info("mysql instance deleted", slog.String("id", id))
	w.WriteHeader(http.StatusNoContent)
}

// GetMySQLConnection handles GET /mysql/{id}/connection
func (h *Handler) GetMySQLConnection(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	db, err := h.getMySQLConnection(ctx, id)
	if err != nil {
		h.writeMySQLConnectionError(w, err)
		return
	}
	defer db.Close()

	var version string
	if err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to get version")
		return
	}

	h.writeJSON(w, http.StatusOK, ConnectionStatus{
		Connected: true,
		Version:   version,
	})
}

// RunMySQLQuery handles POST /mysql/{id}/query — mirrors RunQuery (Postgres),
// including the []byte→string fix for JSON marshaling.
func (h *Handler) RunMySQLQuery(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.SQL == "" {
		h.writeError(w, http.StatusBadRequest, "sql is required")
		return
	}

	db, err := h.getMySQLConnection(ctx, id)
	if err != nil {
		h.writeMySQLConnectionError(w, err)
		return
	}
	defer db.Close()

	start := time.Now()
	rows, err := db.QueryContext(ctx, req.SQL)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		h.writeJSON(w, http.StatusOK, QueryResponse{
			Error:         err.Error(),
			ExecutionTime: elapsed,
		})
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		h.writeJSON(w, http.StatusOK, QueryResponse{
			Error:         err.Error(),
			ExecutionTime: elapsed,
		})
		return
	}

	var result [][]interface{}
	for rows.Next() {
		raw := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range columns {
			ptrs[i] = &raw[i]
		}

		if err := rows.Scan(ptrs...); err != nil {
			continue
		}

		row := make([]interface{}, len(columns))
		for i, v := range raw {
			// The mysql driver scans most types as []byte; JSON would
			// base64-encode those, so convert to string before marshaling.
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		result = append(result, row)
	}

	if result == nil {
		result = [][]interface{}{}
	}

	h.writeJSON(w, http.StatusOK, QueryResponse{
		Columns:       columns,
		Rows:          result,
		RowCount:      len(result),
		ExecutionTime: elapsed,
	})
}
