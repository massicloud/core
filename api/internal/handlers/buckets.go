package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// bucketNameRegex validates S3-compatible bucket names (3–63 chars).
var bucketNameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

// CreateBucket handles POST /storage/buckets
func (h *Handler) CreateBucket(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.CreateBucketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := strings.ToLower(strings.TrimSpace(req.Name))
	if !bucketNameRegex.MatchString(name) {
		h.writeError(w, http.StatusBadRequest,
			"bucket name must be 3-63 chars, lowercase letters, numbers, hyphens only")
		return
	}

	if req.ProjectID == "" {
		h.writeError(w, http.StatusBadRequest, "project_id is required")
		return
	}

	project, err := h.store.GetProjectByID(ctx, req.ProjectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	if err := h.storage.CreateBucket(ctx, name, req.Public); err != nil {
		h.logger.Error("failed to create minio bucket",
			slog.String("name", name),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to create bucket: %s", err.Error()))
		return
	}

	bucket := models.Bucket{
		ID:        uuid.New().String(),
		ProjectID: req.ProjectID,
		Name:      name,
		Public:    req.Public,
		CreatedAt: time.Now(),
	}

	if err := h.store.CreateBucket(ctx, bucket); err != nil {
		// Best-effort rollback — ignore secondary error.
		_ = h.storage.DeleteBucket(ctx, name)
		h.writeError(w, http.StatusInternalServerError, "failed to save bucket metadata")
		return
	}

	h.writeJSON(w, http.StatusCreated, bucket)
}

// getOwnedBucket resolves a bucket by name and verifies it belongs to a
// project owned by the authenticated dashboard user, writing the
// appropriate error response and returning ok=false if not.
func (h *Handler) getOwnedBucket(ctx context.Context, w http.ResponseWriter, r *http.Request, name string) (models.Bucket, bool) {
	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return models.Bucket{}, false
	}

	bucket, err := h.store.GetBucketByName(ctx, name)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "bucket not found")
		return models.Bucket{}, false
	}

	project, err := h.store.GetProjectByID(ctx, bucket.ProjectID)
	if err != nil || project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied to bucket")
		return models.Bucket{}, false
	}

	return bucket, true
}

// ListBuckets handles GET /storage/buckets?project_id=xxx
func (h *Handler) ListBuckets(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	projectID := r.URL.Query().Get("project_id")
	if projectID == "" {
		h.writeError(w, http.StatusBadRequest, "project_id query param required")
		return
	}

	buckets, err := h.store.ListBuckets(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list buckets")
		return
	}

	// Refresh stats from MinIO in parallel so the response always has real data.
	// This is the only authoritative source of truth — SQLite is just a cache.
	var wg sync.WaitGroup
	for i := range buckets {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			size, count, err := h.storage.GetBucketStats(ctx, buckets[idx].Name)
			if err != nil {
				h.logger.Warn("could not refresh bucket stats",
					slog.String("bucket", buckets[idx].Name),
					slog.Any("error", err),
				)
				return
			}
			buckets[idx].SizeBytes = size
			buckets[idx].FileCount = count
			// Write-back so the cached value converges over time.
			_ = h.store.UpdateBucketStats(ctx, buckets[idx].ID, size, count)
		}(i)
	}
	wg.Wait()

	h.writeJSON(w, http.StatusOK, buckets)
}

// DeleteBucket handles DELETE /storage/buckets/{name}
func (h *Handler) DeleteBucket(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	name := chi.URLParam(r, "name")

	bucket, ok := h.getOwnedBucket(ctx, w, r, name)
	if !ok {
		return
	}

	if err := h.storage.DeleteBucket(ctx, name); err != nil {
		h.writeError(w, http.StatusInternalServerError,
			"failed to delete bucket — make sure it is empty first")
		return
	}

	if err := h.store.DeleteBucket(ctx, bucket.ID); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to delete bucket record")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RenameBucket handles PATCH /storage/buckets/{name}
func (h *Handler) RenameBucket(w http.ResponseWriter, r *http.Request) {
	// Rename can be slow for large buckets (server-side copy), allow up to 5 min.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	name := chi.URLParam(r, "name")

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	newName := strings.ToLower(strings.TrimSpace(body.Name))
	if !bucketNameRegex.MatchString(newName) {
		h.writeError(w, http.StatusBadRequest,
			"bucket name must be 3-63 chars, lowercase letters, numbers, hyphens only")
		return
	}
	if newName == name {
		h.writeError(w, http.StatusBadRequest, "new name must differ from current name")
		return
	}

	bucket, ok := h.getOwnedBucket(ctx, w, r, name)
	if !ok {
		return
	}

	if err := h.storage.RenameBucket(ctx, name, newName); err != nil {
		h.logger.Error("failed to rename bucket",
			slog.String("from", name),
			slog.String("to", newName),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError,
			fmt.Sprintf("failed to rename bucket: %s", err.Error()))
		return
	}

	if err := h.store.RenameBucket(ctx, bucket.ID, newName); err != nil {
		h.writeError(w, http.StatusInternalServerError, "bucket renamed in storage but metadata update failed")
		return
	}

	bucket.Name = newName
	h.writeJSON(w, http.StatusOK, bucket)
}

// UpdateBucketPolicy handles PUT /storage/buckets/{name}/policy
func (h *Handler) UpdateBucketPolicy(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	name := chi.URLParam(r, "name")

	var body struct {
		Public bool `json:"public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	bucket, ok := h.getOwnedBucket(ctx, w, r, name)
	if !ok {
		return
	}

	if err := h.storage.SetBucketPublic(ctx, name, body.Public); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to update bucket policy")
		return
	}

	if err := h.store.UpdateBucketPublic(ctx, bucket.ID, body.Public); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to save policy change")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"public": body.Public})
}
