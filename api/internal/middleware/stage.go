package middleware

import (
	"context"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/store"
)

const CtxStage contextKey = "stage"

// RequireProjectStage resolves the {stage} URL param to a Stage record and
// stores it in context. Must run after RequireProjectKey.
func RequireProjectStage(s *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			project, ok := r.Context().Value(CtxProject).(models.Project)
			if !ok {
				writeMiddlewareJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "project context missing",
				})
				return
			}

			stageName := chi.URLParam(r, "stage")
			if stageName == "" {
				writeMiddlewareJSON(w, http.StatusBadRequest, map[string]string{
					"error": "stage name required in URL",
				})
				return
			}

			stage, err := s.GetStageByName(r.Context(), project.ID, stageName)
			if err != nil {
				writeMiddlewareJSON(w, http.StatusNotFound, map[string]string{
					"error": fmt.Sprintf("no stage named %q in this project", stageName),
				})
				return
			}

			ctx := context.WithValue(r.Context(), CtxStage, stage)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireStageInstance resolves the {db} URL param to a postgres Instance
// within the current stage. Must run after RequireProjectStage.
func RequireStageInstance(s *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			stage, ok := r.Context().Value(CtxStage).(models.Stage)
			if !ok {
				writeMiddlewareJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "stage context missing",
				})
				return
			}

			dbName := chi.URLParam(r, "db")
			if dbName == "" {
				writeMiddlewareJSON(w, http.StatusBadRequest, map[string]string{
					"error": "db name required in URL",
				})
				return
			}

			instance, err := s.GetInstanceByStageAndName(r.Context(), stage.ID, dbName)
			if err != nil {
				writeMiddlewareJSON(w, http.StatusNotFound, map[string]string{
					"error": fmt.Sprintf("no database named %q in stage %q", dbName, stage.Name),
				})
				return
			}

			if instance.Type != models.InstanceTypePostgres {
				writeMiddlewareJSON(w, http.StatusBadRequest, map[string]string{
					"error": fmt.Sprintf("%q is not a postgres instance", dbName),
				})
				return
			}

			ctx := context.WithValue(r.Context(), CtxInstance, instance)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
