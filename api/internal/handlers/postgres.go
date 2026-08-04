package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// ListPostgres handles GET /postgres?project_id=X
func (h *Handler) ListPostgres(w http.ResponseWriter, r *http.Request) {
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

	// Fetch all instances for the project (via stage join) and filter to postgres.
	allInstances, err := h.store.GetInstancesForProject(ctx, projectID)
	if err != nil {
		h.logger.Error("failed to list postgres instances", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to list databases")
		return
	}

	instances := make([]models.Instance, 0)
	for _, inst := range allInstances {
		if inst.Type == models.InstanceTypePostgres {
			instances = append(instances, inst)
		}
	}

	h.writeJSON(w, http.StatusOK, instances)
}

// DeletePostgres handles DELETE /postgres/{id}
func (h *Handler) DeletePostgres(w http.ResponseWriter, r *http.Request) {
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

	h.logger.Info("postgres instance deleted", slog.String("id", id))
	w.WriteHeader(http.StatusNoContent)
}
