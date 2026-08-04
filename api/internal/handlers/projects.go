package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/projectauth"
)

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		h.writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	slug := generateSlug(req.Name)

	project := models.Project{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Slug:        slug,
		Description: req.Description,
		UserID:      claims.UserID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.store.CreateProject(ctx, project); err != nil {
		h.logger.Error("failed to create project",
			slog.String("name", req.Name),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}

	// Generate and persist the project JWT signing secret.
	signingSecret, err := projectauth.GenerateSigningSecret()
	if err != nil {
		h.store.DeleteProject(ctx, project.ID) //nolint:errcheck
		h.writeError(w, http.StatusInternalServerError, "failed to generate signing secret")
		return
	}
	if err := h.store.SetProjectSigningSecret(ctx, project.ID, signingSecret); err != nil {
		h.store.DeleteProject(ctx, project.ID) //nolint:errcheck
		h.writeError(w, http.StatusInternalServerError, "failed to save signing secret")
		return
	}
	project.JWTSigningSecret = signingSecret

	// Generate anon and service API keys.
	anonKey, err := h.createAPIKey(ctx, project.ID, models.APIKeyAnon)
	if err != nil {
		h.store.DeleteProject(ctx, project.ID) //nolint:errcheck
		h.writeError(w, http.StatusInternalServerError, "failed to generate anon key")
		return
	}

	serviceKey, err := h.createAPIKey(ctx, project.ID, models.APIKeyService)
	if err != nil {
		h.store.DeleteProject(ctx, project.ID) //nolint:errcheck
		h.writeError(w, http.StatusInternalServerError, "failed to generate service key")
		return
	}

	// Auto-provision the production stage with a "main" postgres + auth_basic preset.
	stage, err := h.provisionStage(ctx, project, "production", true, nil)
	if err != nil {
		h.logger.Error("failed to provision production stage",
			slog.String("project_id", project.ID),
			slog.Any("error", err),
		)
		h.store.DeleteProject(ctx, project.ID) //nolint:errcheck
		h.writeError(w, http.StatusInternalServerError, "failed to provision production stage")
		return
	}

	h.logger.Info("project created",
		slog.String("id", project.ID),
		slog.String("slug", project.Slug),
		slog.String("production_stage_id", stage.ID),
	)

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"project":     project,
		"anon_key":    anonKey,
		"service_key": serviceKey,
		"stage":       stage,
	})
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projects, err := h.store.ListProjects(ctx, claims.UserID)
	if err != nil {
		h.logger.Error("failed to list projects", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}

	if projects == nil {
		projects = []models.Project{}
	}
	h.writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	project, err := h.store.GetProjectByID(ctx, id)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}

	h.writeJSON(w, http.StatusOK, project)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	// Tear down all tenant workloads before deleting the DB records.
	stages, _ := h.store.ListStagesForProject(ctx, id)
	for _, stage := range stages {
		instances, _ := h.store.GetInstancesForStage(ctx, stage.ID)
		for _, inst := range instances {
			h.teardownInstance(ctx, inst)
		}
	}
	if err := h.k8s.DeleteTenantNamespace(ctx, id); err != nil {
		h.logger.Warn("failed to delete tenant namespace",
			slog.String("project_id", id), slog.Any("error", err))
	}

	if err := h.store.DeleteProject(ctx, id); err != nil {
		h.logger.Error("failed to delete project",
			slog.String("id", id),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}

	h.logger.Info("project deleted", slog.String("id", id))
	w.WriteHeader(http.StatusNoContent)
}

// generateSlug creates a URL-safe slug from a name
func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])
	return slug
}
