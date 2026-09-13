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

// mongoInstanceResponse is the API shape for a mongo instance. Like redis
// (and unlike postgres, which is only ever accessed through the server-side
// SQL proxy), mongo instances are connected to directly by the user's own
// apps via the native driver, so both connection strings need to reach the
// frontend.
type mongoInstanceResponse struct {
	ID             string `json:"id"`
	StageID        string `json:"stage_id"`
	Type           string `json:"type"`
	Name           string `json:"name"`
	DatabaseName   string `json:"database_name"`
	ServiceDSN     string `json:"service_dsn"`
	ReadonlyDSN    string `json:"readonly_dsn"`
	MemoryMB       int    `json:"memory_mb"`
	BackupSchedule string `json:"backup_schedule"`
	RetentionDays  int    `json:"retention_days"`
	CreatedAt      string `json:"created_at"`
}

func toMongoInstanceResponse(inst models.Instance) mongoInstanceResponse {
	return mongoInstanceResponse{
		ID:             inst.ID,
		StageID:        inst.StageID,
		Type:           inst.Type,
		Name:           inst.Name,
		DatabaseName:   mongoDatabaseNameFromDSN(inst.DSN),
		ServiceDSN:     inst.DSN,
		ReadonlyDSN:    inst.ReadonlyDSN,
		MemoryMB:       inst.MemoryMB,
		BackupSchedule: inst.BackupSchedule,
		RetentionDays:  inst.RetentionDays,
		CreatedAt:      inst.CreatedAt.Format(time.RFC3339),
	}
}

// ListMongo handles GET /mongo?project_id=X
func (h *Handler) ListMongo(w http.ResponseWriter, r *http.Request) {
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
		h.logger.Error("failed to list mongo instances", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to list mongo instances")
		return
	}

	instances := make([]mongoInstanceResponse, 0)
	for _, inst := range allInstances {
		if inst.Type == models.InstanceTypeMongo {
			instances = append(instances, toMongoInstanceResponse(inst))
		}
	}

	h.writeJSON(w, http.StatusOK, instances)
}

// DeleteMongo handles DELETE /mongo/{id}
func (h *Handler) DeleteMongo(w http.ResponseWriter, r *http.Request) {
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

	h.logger.Info("mongo instance deleted", slog.String("id", id))
	w.WriteHeader(http.StatusNoContent)
}
