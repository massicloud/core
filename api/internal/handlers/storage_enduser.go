package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/projectauth"
)

// resolveProjectBucket looks up a bucket by name and verifies it belongs to
// the project the caller authenticated against with their API key (set by
// RequireProjectKey). Unlike getOwnedBucket (dashboard JWT + project
// ownership by user), this checks ownership by project, since end users
// authenticate as a project's API consumer, not its dashboard owner.
func (h *Handler) resolveProjectBucket(ctx context.Context, w http.ResponseWriter, r *http.Request, name string) (models.Bucket, bool) {
	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return models.Bucket{}, false
	}

	bucket, err := h.store.GetBucketByName(ctx, name)
	if err != nil || bucket.ProjectID != project.ID {
		h.writeError(w, http.StatusNotFound, "bucket not found")
		return models.Bucket{}, false
	}

	return bucket, true
}

// requireBucketReadAccess allows the request through if the bucket is
// public, or if a valid end-user session is present (set by
// OptionalEndUserToken). Private buckets reject anonymous reads.
func requireBucketReadAccess(w http.ResponseWriter, r *http.Request, bucket models.Bucket) bool {
	if bucket.Public {
		return true
	}
	if _, ok := r.Context().Value(middleware.CtxEndUserClaims).(*projectauth.EndUserClaims); ok {
		return true
	}
	writeJSONError(w, http.StatusForbidden, "this bucket is private — sign in to access it")
	return false
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(fmt.Sprintf(`{"error":%q}`, msg)))
}

// EndUserListObjects handles GET /v1/{slug}/storage/buckets/{name}/objects
func (h *Handler) EndUserListObjects(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	bucket, ok := h.resolveProjectBucket(ctx, w, r, chi.URLParam(r, "name"))
	if !ok {
		return
	}
	if !requireBucketReadAccess(w, r, bucket) {
		return
	}

	prefix := r.URL.Query().Get("prefix")
	maxKeys := 100
	if mk := r.URL.Query().Get("max_keys"); mk != "" {
		if parsed, err := strconv.Atoi(mk); err == nil && parsed > 0 {
			maxKeys = parsed
		}
	}

	result, err := h.storage.ListObjects(ctx, bucket.Name, prefix, maxKeys)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list objects")
		return
	}

	h.writeJSON(w, http.StatusOK, result)
}

// EndUserDownloadObject handles GET /v1/{slug}/storage/buckets/{name}/objects/*
func (h *Handler) EndUserDownloadObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	bucket, ok := h.resolveProjectBucket(ctx, w, r, chi.URLParam(r, "name"))
	if !ok {
		return
	}
	if !requireBucketReadAccess(w, r, bucket) {
		return
	}

	key := objectKey(r)
	obj, info, err := h.storage.GetObject(ctx, bucket.Name, key)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "object not found")
		return
	}
	defer obj.Close()

	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))
	disposition := "attachment"
	if r.URL.Query().Get("inline") == "true" {
		disposition = "inline"
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, filepath.Base(key)))

	if _, err := io.Copy(w, obj); err != nil {
		h.logger.Error("failed to stream object", "bucket", bucket.Name, "key", key, "error", err)
	}
}

// EndUserPresignObject handles POST /v1/{slug}/storage/buckets/{name}/presign
func (h *Handler) EndUserPresignObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	bucket, ok := h.resolveProjectBucket(ctx, w, r, chi.URLParam(r, "name"))
	if !ok {
		return
	}
	if !requireBucketReadAccess(w, r, bucket) {
		return
	}

	var req struct {
		Key              string `json:"key"`
		ExpiresInSeconds int    `json:"expires_in_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Key == "" {
		h.writeError(w, http.StatusBadRequest, "key is required")
		return
	}
	if req.ExpiresInSeconds <= 0 || req.ExpiresInSeconds > 604800 {
		req.ExpiresInSeconds = 3600
	}

	token, err := generateDownloadToken()
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	expiresAt := time.Now().Add(time.Duration(req.ExpiresInSeconds) * time.Second)
	if err := h.store.CreateDownloadToken(ctx, token, bucket.Name, req.Key, expiresAt); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to create download token")
		return
	}

	h.writeJSON(w, http.StatusOK, models.PresignResponse{
		URL:       fmt.Sprintf("%s/storage/download?token=%s", h.config.APIBaseURL, token),
		ExpiresAt: expiresAt,
		Method:    "GET",
	})
}

// EndUserUploadObject handles POST /v1/{slug}/storage/buckets/{name}/objects
// Requires a signed-in end user — anonymous writes are never allowed, even
// to public buckets.
func (h *Handler) EndUserUploadObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	bucket, ok := h.resolveProjectBucket(ctx, w, r, chi.URLParam(r, "name"))
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		h.writeError(w, http.StatusBadRequest, "file too large or invalid multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "file field is required")
		return
	}
	defer file.Close()

	key := r.FormValue("key")
	if key == "" {
		key = header.Filename
	}
	if prefix := r.FormValue("prefix"); prefix != "" {
		key = fmt.Sprintf("%s/%s", prefix, key)
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	obj, err := h.storage.UploadObject(ctx, bucket.Name, key, file, header.Size, contentType)
	if err != nil {
		h.logger.Error("end-user upload failed", "bucket", bucket.Name, "key", key, "error", err)
		h.writeError(w, http.StatusInternalServerError, "failed to upload file")
		return
	}

	if err := h.store.IncrBucketStatsByName(ctx, bucket.Name, obj.Size, 1); err != nil {
		h.logger.Warn("could not update bucket stats after upload", "bucket", bucket.Name, "error", err)
	}

	h.writeJSON(w, http.StatusCreated, obj)
}

// EndUserDeleteObject handles DELETE /v1/{slug}/storage/buckets/{name}/objects/*
// Requires a signed-in end user.
func (h *Handler) EndUserDeleteObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	bucket, ok := h.resolveProjectBucket(ctx, w, r, chi.URLParam(r, "name"))
	if !ok {
		return
	}

	key := objectKey(r)
	objSize, statErr := h.storage.StatObject(ctx, bucket.Name, key)

	if err := h.storage.DeleteObject(ctx, bucket.Name, key); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to delete object")
		return
	}

	sizeDelta := int64(0)
	if statErr == nil {
		sizeDelta = -objSize
	}
	if err := h.store.IncrBucketStatsByName(ctx, bucket.Name, sizeDelta, -1); err != nil {
		h.logger.Warn("could not update bucket stats after delete", "bucket", bucket.Name, "error", err)
	}

	w.WriteHeader(http.StatusNoContent)
}
