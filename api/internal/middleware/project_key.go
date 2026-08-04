package middleware

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/projectauth"
	"github.com/mikaminou/massicloud/api/internal/store"
)

const (
	CtxProject       contextKey = "project"
	CtxAPIKey        contextKey = "apiKey"
	CtxEndUserClaims contextKey = "endUserClaims"
)

// RequireProjectKey validates the project exists and the caller has a valid API key.
// Sets CtxProject and CtxAPIKey in the request context.
func RequireProjectKey(s *store.Store, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slug := chi.URLParam(r, "slug")

			project, err := s.GetProjectBySlug(r.Context(), slug)
			if err != nil {
				writeMiddlewareJSON(w, http.StatusNotFound, map[string]string{
					"error": "project not found",
				})
				return
			}

			// Accept X-MassiCloud-Key or the Supabase-compatible apikey header.
			apikey := r.Header.Get("X-MassiCloud-Key")
			if apikey == "" {
				apikey = r.Header.Get("apikey")
			}

			if apikey == "" {
				writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "missing X-MassiCloud-Key header",
				})
				return
			}

			if len(apikey) < 16 {
				writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "invalid api key",
				})
				return
			}

			prefix := apikey[:16]
			keyRecord, err := s.GetAPIKeyByPrefix(r.Context(), prefix)
			if err != nil || keyRecord.ProjectID != project.ID {
				writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "invalid api key",
				})
				return
			}

			if !projectauth.VerifyAPIKey(apikey, keyRecord.KeyHash) {
				writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "invalid api key",
				})
				return
			}

			// Touch last_used_at asynchronously — non-blocking.
			go s.TouchAPIKeyUsage(context.Background(), keyRecord.ID)

			ctx := context.WithValue(r.Context(), CtxProject, project)
			ctx = context.WithValue(ctx, CtxAPIKey, keyRecord)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireEndUserToken validates a Bearer JWT signed by the project's signing secret.
// Must run after RequireProjectKey so the project context is already set.
func RequireEndUserToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		project, ok := r.Context().Value(CtxProject).(models.Project)
		if !ok {
			writeMiddlewareJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "project context missing",
			})
			return
		}

		authz := r.Header.Get("Authorization")
		if !strings.HasPrefix(authz, "Bearer ") {
			writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "missing bearer token",
			})
			return
		}
		token := strings.TrimPrefix(authz, "Bearer ")

		claims, err := projectauth.ParseToken(token, project.JWTSigningSecret)
		if err != nil || claims.Type != "access" {
			writeMiddlewareJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid access token",
			})
			return
		}

		ctx := context.WithValue(r.Context(), CtxEndUserClaims, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalEndUserToken parses a Bearer JWT if present and sets CtxEndUserClaims,
// but never rejects the request — used on read routes where a public bucket
// is accessible without auth and a private bucket requires the caller to
// have a valid end-user session (checked by the handler itself).
// Must run after RequireProjectKey so the project context is already set.
func OptionalEndUserToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		project, ok := r.Context().Value(CtxProject).(models.Project)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

		authz := r.Header.Get("Authorization")
		if !strings.HasPrefix(authz, "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}
		token := strings.TrimPrefix(authz, "Bearer ")

		claims, err := projectauth.ParseToken(token, project.JWTSigningSecret)
		if err != nil || claims.Type != "access" {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), CtxEndUserClaims, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeMiddlewareJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}
