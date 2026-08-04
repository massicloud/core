package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// CreateBackup handles POST /postgres/{id}/backups
func (h *Handler) CreateBackup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")

	instance, err := h.store.GetInstance(ctx, instanceID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "instance not found")
		return
	}

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if _, err := h.backupService.CreateBackup(bgCtx, instance, models.BackupManual); err != nil {
			h.logger.Error("manual backup failed",
				slog.String("instance_id", instanceID),
				slog.Any("error", err),
			)
		}
	}()

	h.writeJSON(w, http.StatusAccepted, map[string]string{
		"status":  "started",
		"message": "Backup running in background",
	})
}

// ListBackups handles GET /postgres/{id}/backups
func (h *Handler) ListBackups(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")

	backups, err := h.store.ListBackups(ctx, instanceID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list backups")
		return
	}

	h.writeJSON(w, http.StatusOK, backups)
}

// DeleteBackup handles DELETE /postgres/{id}/backups/{backup_id}
func (h *Handler) DeleteBackup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	backupID := chi.URLParam(r, "backup_id")

	if err := h.backupService.DeleteBackup(ctx, backupID); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RestoreBackup handles POST /postgres/{id}/backups/{backup_id}/restore
// Creates a brand-new postgres instance from the backup (non-destructive restore).
// Body must include "stage_id" to specify where the new instance should be created.
func (h *Handler) RestoreBackup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	backupID := chi.URLParam(r, "backup_id")

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.RestoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := models.ValidateInstanceName(req.NewName); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.StageID == "" {
		h.writeError(w, http.StatusBadRequest, "stage_id is required")
		return
	}

	b, err := h.store.GetBackup(ctx, backupID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "backup not found")
		return
	}
	if b.Status != models.BackupCompleted {
		h.writeError(w, http.StatusBadRequest, "can only restore from completed backups")
		return
	}

	// Verify the caller owns the backup's project.
	project, err := h.store.GetProjectByID(ctx, b.ProjectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	// Verify the target stage belongs to the same project.
	stage, err := h.store.GetStage(ctx, req.StageID)
	if err != nil || stage.ProjectID != project.ID {
		h.writeError(w, http.StatusBadRequest, "stage not found in this project")
		return
	}

	memoryMB := req.MemoryMB
	if memoryMB <= 0 {
		memoryMB = 512
	}

	instReq := models.CreateInstanceForStageRequest{
		Name:         req.NewName,
		Type:         models.InstanceTypePostgres,
		MemoryMB:     memoryMB,
		SchemaPreset: "blank",
	}

	newInstance, err := h.createInstanceInStage(ctx, project, req.StageID, instReq)
	if err != nil {
		h.logger.Error("restore: create instance failed",
			slog.String("backup_id", backupID),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to create target instance: "+err.Error())
		return
	}

	// Give Postgres a moment to finish initialising before pg_restore connects.
	time.Sleep(5 * time.Second)

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
		defer cancel()
		if err := h.backupService.Restore(bgCtx, backupID, newInstance); err != nil {
			h.logger.Error("restore failed",
				slog.String("backup_id", backupID),
				slog.String("new_instance_id", newInstance.ID),
				slog.Any("error", err),
			)
		}
	}()

	h.writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"status":          "restoring",
		"new_instance_id": newInstance.ID,
		"message":         "Restore running in background. The new instance will be available shortly.",
	})
}

// UpdateBackupSettings handles PUT /postgres/{id}/backup-settings
func (h *Handler) UpdateBackupSettings(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")

	var req models.UpdateBackupSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.BackupSchedule != "daily" && req.BackupSchedule != "disabled" {
		h.writeError(w, http.StatusBadRequest, "backup_schedule must be 'daily' or 'disabled'")
		return
	}
	if req.RetentionDays != 7 && req.RetentionDays != 30 && req.RetentionDays != 90 {
		h.writeError(w, http.StatusBadRequest, "retention_days must be 7, 30, or 90")
		return
	}

	if err := h.store.UpdateInstanceBackupSettings(
		ctx, instanceID, req.BackupSchedule, req.RetentionDays,
	); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to update backup settings")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"backup_schedule": req.BackupSchedule,
		"retention_days":  req.RetentionDays,
	})
}
