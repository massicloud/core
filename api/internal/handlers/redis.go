package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// redisInstanceResponse is the API shape for a redis instance. Unlike
// postgres (which is only ever accessed through the server-side SQL proxy),
// redis instances are connected to directly by the user's own apps, so the
// host/port/password need to reach the frontend.
type redisInstanceResponse struct {
	ID             string `json:"id"`
	StageID        string `json:"stage_id"`
	Type           string `json:"type"`
	Name           string `json:"name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Password       string `json:"password"`
	DSN            string `json:"dsn"`
	MemoryMB       int    `json:"memory_mb"`
	BackupSchedule string `json:"backup_schedule"`
	RetentionDays  int    `json:"retention_days"`
	CreatedAt      string `json:"created_at"`
}

func toRedisInstanceResponse(inst models.Instance) redisInstanceResponse {
	host, port, password := parseRedisDSN(inst.DSN)
	return redisInstanceResponse{
		ID:             inst.ID,
		StageID:        inst.StageID,
		Type:           inst.Type,
		Name:           inst.Name,
		Host:           host,
		Port:           port,
		Password:       password,
		DSN:            inst.DSN,
		MemoryMB:       inst.MemoryMB,
		BackupSchedule: inst.BackupSchedule,
		RetentionDays:  inst.RetentionDays,
		CreatedAt:      inst.CreatedAt.Format(time.RFC3339),
	}
}

func parseRedisDSN(dsn string) (host string, port int, password string) {
	u, err := url.Parse(dsn)
	if err != nil {
		return "", 0, ""
	}
	host = u.Hostname()
	if p := u.Port(); p != "" {
		port, _ = strconv.Atoi(p)
	}
	password, _ = u.User.Password()
	return host, port, password
}

// ListRedis handles GET /redis?project_id=X
func (h *Handler) ListRedis(w http.ResponseWriter, r *http.Request) {
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
		h.logger.Error("failed to list redis instances", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to list redis instances")
		return
	}

	instances := make([]redisInstanceResponse, 0)
	for _, inst := range allInstances {
		if inst.Type == models.InstanceTypeRedis {
			instances = append(instances, toRedisInstanceResponse(inst))
		}
	}

	h.writeJSON(w, http.StatusOK, instances)
}

// DeleteRedis handles DELETE /redis/{id}
func (h *Handler) DeleteRedis(w http.ResponseWriter, r *http.Request) {
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

	h.logger.Info("redis instance deleted", slog.String("id", id))
	w.WriteHeader(http.StatusNoContent)
}
