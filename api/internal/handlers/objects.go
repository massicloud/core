package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mikaminou/massicloud/api/internal/models"
)

const maxUploadSize = 100 * 1024 * 1024 // 100 MB

// objectKey extracts and normalises the wildcard path param.
// chi may include a leading "/" inside sub-routers, and the value may be
// URL-encoded, so we decode and strip both.
func objectKey(r *http.Request) string {
	raw := chi.URLParam(r, "*")
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		decoded = raw
	}
	return strings.TrimPrefix(decoded, "/")
}

// ListObjects handles GET /storage/buckets/{name}/objects
func (h *Handler) ListObjects(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	bucketName := chi.URLParam(r, "name")
	prefix := r.URL.Query().Get("prefix")

	bucket, ok := h.getOwnedBucket(ctx, w, r, bucketName)
	if !ok {
		return
	}

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

// UploadObject handles POST /storage/buckets/{name}/objects
func (h *Handler) UploadObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	bucketName := chi.URLParam(r, "name")

	bucket, ok := h.getOwnedBucket(ctx, w, r, bucketName)
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
		h.logger.Error("upload failed",
			slog.String("bucket", bucket.Name),
			slog.String("key", key),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to upload file")
		return
	}

	// Increment bucket stats synchronously so the next list returns accurate data.
	if err := h.store.IncrBucketStatsByName(ctx, bucket.Name, obj.Size, 1); err != nil {
		h.logger.Warn("could not update bucket stats after upload",
			slog.String("bucket", bucket.Name),
			slog.Any("error", err),
		)
	}

	h.writeJSON(w, http.StatusCreated, obj)
}

// DownloadObject handles GET /storage/buckets/{name}/objects/* and streams the file.
func (h *Handler) DownloadObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	bucketName := chi.URLParam(r, "name")
	key := objectKey(r)

	bucket, ok := h.getOwnedBucket(ctx, w, r, bucketName)
	if !ok {
		return
	}

	obj, info, err := h.storage.GetObject(ctx, bucket.Name, key)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "object not found")
		return
	}
	defer obj.Close()

	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(key)))

	if _, err := io.Copy(w, obj); err != nil {
		h.logger.Error("failed to stream object",
			slog.String("bucket", bucket.Name),
			slog.String("key", key),
			slog.Any("error", err),
		)
	}
}

// DeleteObject handles DELETE /storage/buckets/{name}/objects/*
func (h *Handler) DeleteObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	bucketName := chi.URLParam(r, "name")
	key := objectKey(r)

	bucket, ok := h.getOwnedBucket(ctx, w, r, bucketName)
	if !ok {
		return
	}

	h.logger.Info("deleting object",
		slog.String("bucket", bucket.Name),
		slog.String("key", key),
	)

	// Stat before deletion so we can decrement size accurately.
	objSize, statErr := h.storage.StatObject(ctx, bucket.Name, key)

	if err := h.storage.DeleteObject(ctx, bucket.Name, key); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to delete object")
		return
	}

	// Decrement stats synchronously. If stat failed we still decrement count by 1.
	sizeDelta := int64(0)
	if statErr == nil {
		sizeDelta = -objSize
	}
	if err := h.store.IncrBucketStatsByName(ctx, bucket.Name, sizeDelta, -1); err != nil {
		h.logger.Warn("could not update bucket stats after delete",
			slog.String("bucket", bucket.Name),
			slog.Any("error", err),
		)
	}

	w.WriteHeader(http.StatusNoContent)
}

// PresignObject handles POST /storage/buckets/{name}/presign
// Returns a credential-free download token URL — never exposes MinIO credentials.
func (h *Handler) PresignObject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	bucketName := chi.URLParam(r, "name")

	bucket, ok := h.getOwnedBucket(ctx, w, r, bucketName)
	if !ok {
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

	downloadURL := fmt.Sprintf("%s/storage/download?token=%s", h.config.APIBaseURL, token)

	h.writeJSON(w, http.StatusOK, models.PresignResponse{
		URL:       downloadURL,
		ExpiresAt: expiresAt,
		Method:    "GET",
	})
}

// DownloadViaToken handles GET /storage/download?token=<token>
// Public endpoint — no JWT required. The token itself authorises access.
func (h *Handler) DownloadViaToken(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	token := r.URL.Query().Get("token")
	if token == "" {
		h.writeError(w, http.StatusBadRequest, "token is required")
		return
	}

	tok, err := h.store.GetDownloadToken(ctx, token)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "invalid or expired token")
		return
	}

	if time.Now().After(tok.ExpiresAt) {
		_ = h.store.DeleteDownloadToken(ctx, token)
		h.writeError(w, http.StatusGone, "token has expired")
		return
	}

	obj, info, err := h.storage.GetObject(ctx, tok.Bucket, tok.Key)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "object not found")
		return
	}
	defer obj.Close()

	name := filepath.Base(tok.Key)
	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))

	disposition := "attachment"
	if r.URL.Query().Get("inline") == "true" {
		disposition = "inline"
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, name))

	if _, err := io.Copy(w, obj); err != nil {
		h.logger.Error("failed to stream via token",
			slog.String("bucket", tok.Bucket),
			slog.String("key", tok.Key),
			slog.Any("error", err),
		)
	}
}

func generateDownloadToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
