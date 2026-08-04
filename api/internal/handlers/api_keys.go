package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/projectauth"
)

// ListAPIKeys GET /projects/{id}/keys
// Returns both keys but NOT the secret (only prefix shown).
func (h *Handler) ListAPIKeys(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	projectID := chi.URLParam(r, "id")

	claims, _ := middleware.GetClaims(r)
	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil || project.UserID != claims.UserID {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}

	keys, err := h.store.GetAPIKeysForProject(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list keys")
		return
	}

	if keys == nil {
		keys = []models.APIKey{}
	}
	h.writeJSON(w, http.StatusOK, keys)
}

// RotateAPIKey POST /projects/{id}/keys/{type}/rotate
// Revokes the existing key of the given type and issues a new one.
// Returns the new full key — only chance to copy it.
func (h *Handler) RotateAPIKey(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	projectID := chi.URLParam(r, "id")
	keyType := models.APIKeyType(chi.URLParam(r, "type"))

	if keyType != models.APIKeyAnon && keyType != models.APIKeyService {
		h.writeError(w, http.StatusBadRequest, "key type must be 'anon' or 'service'")
		return
	}

	claims, _ := middleware.GetClaims(r)
	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil || project.UserID != claims.UserID {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}

	existing, _ := h.store.GetAPIKeysForProject(ctx, projectID)
	for _, k := range existing {
		if k.Type == keyType {
			if err := h.store.RevokeAPIKey(ctx, k.ID); err != nil {
				h.logger.Error("failed to revoke key", slog.String("key_id", k.ID))
			}
		}
	}

	newKey, err := h.createAPIKey(ctx, projectID, keyType)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to generate key")
		return
	}

	h.logger.Info("api key rotated",
		slog.String("project_id", projectID),
		slog.String("type", string(keyType)),
	)

	h.writeJSON(w, http.StatusOK, newKey)
}

func (h *Handler) createAPIKey(ctx context.Context, projectID string, keyType models.APIKeyType) (*models.APIKeyWithSecret, error) {
	full, hash, prefix, err := projectauth.GenerateAPIKey(keyType)
	if err != nil {
		return nil, err
	}

	record := models.APIKey{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Type:      keyType,
		KeyPrefix: prefix,
		KeyHash:   hash,
		CreatedAt: time.Now(),
	}

	if err := h.store.CreateAPIKey(ctx, record); err != nil {
		return nil, err
	}

	return &models.APIKeyWithSecret{
		APIKey:  record,
		FullKey: full,
	}, nil
}
