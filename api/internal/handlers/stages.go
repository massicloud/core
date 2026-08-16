package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mikaminou/massicloud/api/internal/initschemas"
	"github.com/mikaminou/massicloud/api/internal/k8s"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// stageResponse is the API shape for a stage — includes its instances.
type stageResponse struct {
	models.Stage
	Instances []models.Instance `json:"instances"`
}

func (h *Handler) hydrateStage(ctx context.Context, stage models.Stage) stageResponse {
	instances, _ := h.store.GetInstancesForStage(ctx, stage.ID)
	if instances == nil {
		instances = []models.Instance{}
	}
	return stageResponse{Stage: stage, Instances: instances}
}

// ListStages handles GET /projects/{id}/stages
func (h *Handler) ListStages(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	projectID := chi.URLParam(r, "id")
	stages, err := h.store.ListStagesForProject(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list stages")
		return
	}

	resp := make([]stageResponse, len(stages))
	for i, s := range stages {
		resp[i] = h.hydrateStage(ctx, s)
	}
	h.writeJSON(w, http.StatusOK, resp)
}

// CreateStage handles POST /projects/{id}/stages
func (h *Handler) CreateStage(w http.ResponseWriter, r *http.Request) {
	// A tenant Postgres StatefulSet's first boot (readiness + schema
	// preset application + PostgREST Deployment readiness) can take a
	// couple of minutes.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := chi.URLParam(r, "id")
	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	var req models.CreateStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := models.ValidateStageName(req.Name); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	stage, err := h.provisionStage(ctx, project, req.Name, req.IsProtected, req.InitialInstance)
	if err != nil {
		h.logger.Error("failed to create stage",
			slog.String("project_id", projectID),
			slog.String("stage", req.Name),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to create stage: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, h.hydrateStage(ctx, stage))
}

// DeleteStage handles DELETE /projects/{id}/stages/{stage_name}
func (h *Handler) DeleteStage(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := chi.URLParam(r, "id")
	stageName := chi.URLParam(r, "stage_name")

	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	stage, err := h.store.GetStageByName(ctx, projectID, stageName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "stage not found")
		return
	}
	if stage.IsProtected {
		h.writeError(w, http.StatusConflict, "cannot delete a protected stage")
		return
	}

	// Tear down all instances in this stage.
	instances, _ := h.store.GetInstancesForStage(ctx, stage.ID)
	for _, inst := range instances {
		h.teardownInstance(ctx, inst)
	}

	if err := h.store.DeleteStage(ctx, stage.ID); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to delete stage")
		return
	}

	h.logger.Info("stage deleted", slog.String("stage_name", stageName))
	w.WriteHeader(http.StatusNoContent)
}

// SetStageProtected handles PATCH /projects/{id}/stages/{stage_name}/protected
func (h *Handler) SetStageProtected(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := chi.URLParam(r, "id")
	stageName := chi.URLParam(r, "stage_name")

	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	stage, err := h.store.GetStageByName(ctx, projectID, stageName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "stage not found")
		return
	}

	var body struct {
		Protected bool `json:"protected"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.store.SetStageProtected(ctx, stage.ID, body.Protected); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to update stage")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"protected": body.Protected})
}

// AddInstanceToStage handles POST /projects/{id}/stages/{stage_name}/instances
func (h *Handler) AddInstanceToStage(w http.ResponseWriter, r *http.Request) {
	// A tenant Postgres StatefulSet's first boot (readiness + schema
	// preset application + PostgREST Deployment readiness) can take a
	// couple of minutes.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := chi.URLParam(r, "id")
	stageName := chi.URLParam(r, "stage_name")

	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	stage, err := h.store.GetStageByName(ctx, projectID, stageName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "stage not found")
		return
	}

	var req models.CreateInstanceForStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validateInstanceRequest(req); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	instance, err := h.createInstanceInStage(ctx, project, stage.ID, req)
	if err != nil {
		h.logger.Error("failed to add instance to stage",
			slog.String("stage_name", stageName),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, "failed to create instance: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, instance)
}

// DeleteInstanceFromStage handles DELETE /projects/{id}/stages/{stage_name}/instances/{instance_name}
func (h *Handler) DeleteInstanceFromStage(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := chi.URLParam(r, "id")
	stageName := chi.URLParam(r, "stage_name")
	instanceName := chi.URLParam(r, "instance_name")

	project, err := h.store.GetProjectByID(ctx, projectID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return
	}

	stage, err := h.store.GetStageByName(ctx, projectID, stageName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "stage not found")
		return
	}

	instance, err := h.store.GetInstanceByStageAndName(ctx, stage.ID, instanceName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "instance not found")
		return
	}

	h.teardownInstance(ctx, instance)

	if err := h.store.DeleteInstance(ctx, instance.ID); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to delete instance")
		return
	}

	h.logger.Info("instance deleted from stage",
		slog.String("instance_name", instanceName),
		slog.String("stage_name", stageName),
		slog.String("project_id", projectID),
	)
	w.WriteHeader(http.StatusNoContent)
}

// ListInstancesForStage handles GET /projects/{id}/stages/{stage_name}/instances
func (h *Handler) ListInstancesForStage(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	projectID := chi.URLParam(r, "id")
	stageName := chi.URLParam(r, "stage_name")

	stage, err := h.store.GetStageByName(ctx, projectID, stageName)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "stage not found")
		return
	}

	instances, err := h.store.GetInstancesForStage(ctx, stage.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list instances")
		return
	}
	if instances == nil {
		instances = []models.Instance{}
	}
	h.writeJSON(w, http.StatusOK, instances)
}

// ListPresets handles GET /schema-presets
func (h *Handler) ListPresets(w http.ResponseWriter, r *http.Request) {
	presets := initschemas.ListAllPresets()
	h.writeJSON(w, http.StatusOK, presets)
}

// =============================================================================
// Private helpers
// =============================================================================

// provisionStage creates a stage record and spins up its initial postgres
// instance with the auth_basic schema preset. If initialInstance is nil a
// default "main" postgres with auth_basic is used.
func (h *Handler) provisionStage(
	ctx context.Context,
	project models.Project,
	stageName string,
	protected bool,
	initialInstance *models.CreateInstanceForStageRequest,
) (models.Stage, error) {
	stage := models.Stage{
		ID:          uuid.New().String(),
		ProjectID:   project.ID,
		Name:        stageName,
		IsProtected: protected,
		CreatedAt:   time.Now(),
	}
	if err := h.store.CreateStage(ctx, stage); err != nil {
		return models.Stage{}, err
	}

	// Ensure the tenant namespace + baseline quota/network isolation exist.
	// Idempotent — cheap no-op on every stage after the project's first.
	if err := h.k8s.EnsureTenantNamespace(ctx, project.ID); err != nil {
		h.store.DeleteStage(ctx, stage.ID) //nolint:errcheck
		return models.Stage{}, fmt.Errorf("ensure tenant namespace: %w", err)
	}
	if err := h.k8s.ApplyTenantResourceQuota(ctx, project.ID, 4, 4096); err != nil {
		h.logger.Warn("apply resource quota failed (continuing)",
			slog.String("project_id", project.ID), slog.Any("error", err))
	}
	if err := h.k8s.ApplyTenantNetworkPolicy(ctx, project.ID); err != nil {
		h.logger.Warn("apply network policy failed (continuing)",
			slog.String("project_id", project.ID), slog.Any("error", err))
	}

	req := models.CreateInstanceForStageRequest{
		Name:         "main",
		Type:         models.InstanceTypePostgres,
		MemoryMB:     512,
		SchemaPreset: "auth_basic",
	}
	if initialInstance != nil {
		req = *initialInstance
	}

	if _, err := h.createInstanceInStage(ctx, project, stage.ID, req); err != nil {
		// Best-effort cleanup: remove stage record (instances cascade)
		h.store.DeleteStage(ctx, stage.ID) //nolint:errcheck
		return models.Stage{}, err
	}

	return stage, nil
}

// createInstanceInStage dispatches to the per-type provisioning flow.
func (h *Handler) createInstanceInStage(
	ctx context.Context,
	project models.Project,
	stageID string,
	req models.CreateInstanceForStageRequest,
) (models.Instance, error) {
	switch req.Type {
	case models.InstanceTypePostgres:
		return h.createPostgresInstance(ctx, project, stageID, req)
	case models.InstanceTypeRedis:
		return h.createRedisInstance(ctx, project, stageID, req)
	default:
		return models.Instance{}, &errBadRequest{
			msg: "type must be 'postgres' or 'redis'",
		}
	}
}

// createPostgresInstance provisions a tenant Postgres StatefulSet+Service on
// k8s, persists the instance record, applies schema presets, and provisions
// PostgREST for it.
func (h *Handler) createPostgresInstance(
	ctx context.Context,
	project models.Project,
	stageID string,
	req models.CreateInstanceForStageRequest,
) (models.Instance, error) {
	instanceID := uuid.New().String()

	pgPassword, err := generateSecret()
	if err != nil {
		return models.Instance{}, fmt.Errorf("generate postgres password: %w", err)
	}

	pgRef, err := h.k8s.CreateTenantPostgres(ctx, k8s.CreatePostgresRequest{
		ProjectID:    project.ID,
		InstanceName: req.Name,
		Password:     pgPassword,
		MemoryMB:     req.MemoryMB,
	})
	if err != nil {
		return models.Instance{}, fmt.Errorf("create postgres: %w", err)
	}

	memMB := req.MemoryMB
	if memMB <= 0 {
		memMB = 512
	}

	inst := models.Instance{
		ID:             instanceID,
		StageID:        stageID,
		Type:           req.Type,
		Name:           req.Name,
		ContainerID:    "", // no docker container id — provisioned on k8s
		DSN:            pgRef.DSN,
		MemoryMB:       memMB,
		BackupSchedule: "daily",
		RetentionDays:  7,
		CreatedAt:      time.Now(),
	}

	if err := h.store.CreateInstance(ctx, inst); err != nil {
		_ = h.k8s.DeleteTenantPostgres(context.Background(), project.ID, req.Name)
		return models.Instance{}, err
	}

	// Apply schema preset (non-fatal — logged and skipped on failure).
	preset := req.SchemaPreset
	if preset == "" {
		preset = "blank"
	}
	var schemaErr error
	if preset == "blank" {
		schemaErr = h.initService.ApplyExtensionsOnly(ctx, instanceID)
	} else {
		schemaErr = applyPresetSchemas(ctx, h.initService, instanceID, preset)
	}
	if schemaErr != nil {
		h.logger.Error("schema preset apply failed (continuing)",
			slog.String("instance_id", instanceID),
			slog.String("preset", preset),
			slog.Any("error", schemaErr),
		)
	}

	// Provision PostgREST sidecar asynchronously, via the scoped `authenticator`
	// role created by the auth schema preset — PostgREST never connects as the
	// postgres superuser.
	go func() {
		pCtx, pCancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer pCancel()
		if err := h.provisionPostgREST(pCtx, project, req.Name, instanceID, pgRef); err != nil {
			h.logger.Error("postgrest provision failed",
				slog.String("instance_id", instanceID),
				slog.Any("error", err))
		}
	}()

	h.logger.Info("instance created",
		slog.String("instance_id", instanceID),
		slog.String("stage_id", stageID),
		slog.String("type", req.Type),
		slog.String("name", req.Name),
	)
	return inst, nil
}

// provisionPostgREST points PostgREST at the tenant Postgres through a scoped
// `authenticator` role (set up by the auth schema preset) and deploys it on k8s.
// If the preset didn't create an `authenticator` role (e.g. "blank"), this is
// a no-op failure that just leaves REST unprovisioned for the instance.
func (h *Handler) provisionPostgREST(
	ctx context.Context,
	project models.Project,
	instanceName, instanceID string,
	pgRef *k8s.PostgresRef,
) error {
	pool, err := h.proxy.GetPool(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("get pool: %w", err)
	}

	authPass, err := generateSecret()
	if err != nil {
		return fmt.Errorf("generate authenticator password: %w", err)
	}
	// Safe: authPass is base64url — no quotes in the string.
	alterSQL := fmt.Sprintf("ALTER ROLE authenticator WITH PASSWORD '%s'", authPass)
	if _, err := pool.Exec(ctx, alterSQL); err != nil {
		return fmt.Errorf("alter role authenticator (auth schema preset applied?): %w", err)
	}
	if err := h.store.SetAuthenticatorPassword(ctx, instanceID, authPass); err != nil {
		return fmt.Errorf("save authenticator password: %w", err)
	}

	pgrstDSN := fmt.Sprintf(
		"postgres://authenticator:%s@%s.%s.svc.cluster.local:%d/postgres?sslmode=disable",
		authPass, pgRef.Service, pgRef.Namespace, pgRef.Port,
	)

	if _, err := h.k8s.CreatePostgRESTForInstance(ctx, k8s.CreatePostgRESTRequest{
		ProjectID:    project.ID,
		InstanceName: instanceName,
		PostgresDSN:  pgrstDSN,
		JWTSecret:    project.JWTSigningSecret,
	}); err != nil {
		return fmt.Errorf("create postgrest: %w", err)
	}

	// PostgRESTContainerID now just gates "has REST been provisioned" — it
	// holds the deterministic k8s Deployment name, not a docker container id.
	if err := h.store.SetPostgRESTContainer(ctx, instanceID, "postgrest-"+instanceName); err != nil {
		return fmt.Errorf("save postgrest marker: %w", err)
	}
	return nil
}

// createRedisInstance provisions a tenant Redis StatefulSet + NodePort
// Service on k8s and persists the instance record. No REST sidecar and no
// schema presets — per concepts/redis.md, the customer's own app connects
// directly using the DSN (host/port/password), not through the platform API.
func (h *Handler) createRedisInstance(
	ctx context.Context,
	project models.Project,
	stageID string,
	req models.CreateInstanceForStageRequest,
) (models.Instance, error) {
	instanceID := uuid.New().String()

	password, err := generateSecret()
	if err != nil {
		return models.Instance{}, fmt.Errorf("generate redis password: %w", err)
	}

	redisRef, err := h.k8s.CreateTenantRedis(ctx, k8s.CreateRedisRequest{
		ProjectID:    project.ID,
		InstanceName: req.Name,
		Password:     password,
		MemoryMB:     req.MemoryMB,
	})
	if err != nil {
		return models.Instance{}, fmt.Errorf("create redis: %w", err)
	}

	memMB := req.MemoryMB
	if memMB <= 0 {
		memMB = 256
	}

	inst := models.Instance{
		ID:             instanceID,
		StageID:        stageID,
		Type:           req.Type,
		Name:           req.Name,
		ContainerID:    "", // no docker container id — provisioned on k8s
		DSN:            redisRef.DSN,
		MemoryMB:       memMB,
		BackupSchedule: "disabled",
		RetentionDays:  0,
		CreatedAt:      time.Now(),
	}
	if err := h.store.CreateInstance(ctx, inst); err != nil {
		_ = h.k8s.DeleteTenantRedis(context.Background(), project.ID, req.Name)
		return models.Instance{}, err
	}

	h.logger.Info("instance created",
		slog.String("instance_id", instanceID),
		slog.String("stage_id", stageID),
		slog.String("type", req.Type),
		slog.String("name", req.Name),
	)
	return inst, nil
}

// teardownInstance removes the k8s resources backing an instance.
func (h *Handler) teardownInstance(ctx context.Context, inst models.Instance) {
	switch inst.Type {
	case models.InstanceTypePostgres, models.InstanceTypeRedis:
	default:
		return
	}

	project, err := h.store.GetProjectForInstance(ctx, inst.ID)
	if err != nil {
		h.logger.Warn("teardown: could not resolve project for instance",
			slog.String("instance_id", inst.ID), slog.Any("error", err))
		return
	}

	switch inst.Type {
	case models.InstanceTypePostgres:
		if err := h.k8s.DeleteTenantPostgREST(ctx, project.ID, inst.Name); err != nil {
			h.logger.Warn("teardown: delete postgrest error",
				slog.String("instance_id", inst.ID), slog.Any("error", err))
		}
		if err := h.k8s.DeleteTenantPostgres(ctx, project.ID, inst.Name); err != nil {
			h.logger.Warn("teardown: delete postgres error",
				slog.String("instance_id", inst.ID), slog.Any("error", err))
		}
		h.initService.RemovePool(inst.ID)
	case models.InstanceTypeRedis:
		if err := h.k8s.DeleteTenantRedis(ctx, project.ID, inst.Name); err != nil {
			h.logger.Warn("teardown: delete redis error",
				slog.String("instance_id", inst.ID), slog.Any("error", err))
		}
	}
}

// applyPresetSchemas runs all schemas listed in the preset.
func applyPresetSchemas(ctx context.Context, svc *initschemas.Service, instanceID, presetID string) error {
	preset, ok := initschemas.GetPreset(presetID)
	if !ok {
		return &errBadRequest{msg: "unknown schema preset: " + presetID}
	}
	if err := svc.ApplyExtensionsOnly(ctx, instanceID); err != nil {
		return err
	}
	for _, schema := range preset.Schemas {
		if err := svc.Apply(ctx, instanceID, schema); err != nil {
			return err
		}
	}
	return nil
}

func validateInstanceRequest(req models.CreateInstanceForStageRequest) error {
	if err := models.ValidateInstanceName(req.Name); err != nil {
		return err
	}
	switch req.Type {
	case models.InstanceTypePostgres, models.InstanceTypeRedis:
		return nil
	default:
		return &errBadRequest{msg: "type must be 'postgres' or 'redis'"}
	}
}

// generateSecret returns a random base64url token, safe to embed unquoted in
// a Postgres connection string or a raw SQL literal.
func generateSecret() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate secret: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

type errBadRequest struct{ msg string }

func (e *errBadRequest) Error() string { return e.msg }
