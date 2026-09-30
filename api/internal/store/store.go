package store

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mikaminou/massicloud/api/internal/metrics"
	"github.com/mikaminou/massicloud/api/internal/models"
)

type Store struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

func New(ctx context.Context, databaseURL string, logger *slog.Logger) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConns = 20
	cfg.ConnConfig.Tracer = metrics.DBTracer{}
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	s := &Store{pool: pool, logger: logger}

	if err := s.migrate(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	s.pool.Close()
	return nil
}

// queryOne runs a query expected to return exactly one row and scans it into T by column name.
func queryOne[T any](ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (T, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		var zero T
		return zero, err
	}
	return pgx.CollectOneRow(rows, pgx.RowToStructByName[T])
}

// queryMany runs a query and scans every row into T by column name.
func queryMany[T any](ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) ([]T, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[T])
}

// =============================================================================
// USER METHODS
// =============================================================================

func (s *Store) CreateUser(ctx context.Context, user models.User) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, email, password, full_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, user.ID, user.Email, user.Password, user.FullName, user.Role, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("store: create user: %w", err)
	}
	return nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (models.User, error) {
	user, err := queryOne[models.User](ctx, s.pool, `SELECT * FROM users WHERE email = $1`, email)
	if err != nil {
		return models.User{}, fmt.Errorf("store: get user by email: %w", err)
	}
	return user, nil
}

func (s *Store) GetUserByID(ctx context.Context, id string) (models.User, error) {
	user, err := queryOne[models.User](ctx, s.pool, `SELECT * FROM users WHERE id = $1`, id)
	if err != nil {
		return models.User{}, fmt.Errorf("store: get user by id: %w", err)
	}
	return user, nil
}

func (s *Store) UserExists(ctx context.Context) (bool, error) {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return false, fmt.Errorf("store: check user exists: %w", err)
	}
	return count > 0, nil
}

// =============================================================================
// PROJECT METHODS
// =============================================================================

func (s *Store) CreateProject(ctx context.Context, project models.Project) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO projects (id, name, slug, description, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, project.ID, project.Name, project.Slug, project.Description, project.UserID,
		project.CreatedAt, project.UpdatedAt)
	if err != nil {
		return fmt.Errorf("store: create project: %w", err)
	}
	return nil
}

func (s *Store) GetProjectByID(ctx context.Context, id string) (models.Project, error) {
	project, err := queryOne[models.Project](ctx, s.pool, `SELECT * FROM projects WHERE id = $1`, id)
	if err != nil {
		return models.Project{}, fmt.Errorf("store: get project by id: %w", err)
	}
	return project, nil
}

func (s *Store) GetProjectBySlug(ctx context.Context, slug string) (models.Project, error) {
	project, err := queryOne[models.Project](ctx, s.pool, `SELECT * FROM projects WHERE slug = $1`, slug)
	if err != nil {
		return models.Project{}, fmt.Errorf("store: get project by slug: %w", err)
	}
	return project, nil
}

func (s *Store) ListProjects(ctx context.Context, userID string) ([]models.Project, error) {
	projects, err := queryMany[models.Project](ctx, s.pool,
		`SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("store: list projects: %w", err)
	}
	return projects, nil
}

func (s *Store) DeleteProject(ctx context.Context, id string) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id); err != nil {
		return fmt.Errorf("store: delete project: %w", err)
	}
	return nil
}

// =============================================================================
// STAGE METHODS
// =============================================================================

func (s *Store) CreateStage(ctx context.Context, stage models.Stage) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO stages (id, project_id, name, is_protected, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, stage.ID, stage.ProjectID, stage.Name, stage.IsProtected, stage.CreatedAt)
	if err != nil {
		return fmt.Errorf("store: create stage: %w", err)
	}
	return nil
}

func (s *Store) GetStage(ctx context.Context, id string) (models.Stage, error) {
	stage, err := queryOne[models.Stage](ctx, s.pool, `SELECT * FROM stages WHERE id = $1`, id)
	if err != nil {
		return models.Stage{}, fmt.Errorf("store: get stage: %w", err)
	}
	return stage, nil
}

func (s *Store) GetStageByName(ctx context.Context, projectID, name string) (models.Stage, error) {
	stage, err := queryOne[models.Stage](ctx, s.pool,
		`SELECT * FROM stages WHERE project_id = $1 AND name = $2`, projectID, name)
	if err != nil {
		return models.Stage{}, fmt.Errorf("store: get stage by name: %w", err)
	}
	return stage, nil
}

func (s *Store) ListStagesForProject(ctx context.Context, projectID string) ([]models.Stage, error) {
	stages, err := queryMany[models.Stage](ctx, s.pool,
		`SELECT * FROM stages WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, fmt.Errorf("store: list stages: %w", err)
	}
	return stages, nil
}

func (s *Store) DeleteStage(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM stages WHERE id = $1`, id)
	return err
}

func (s *Store) SetStageProtected(ctx context.Context, id string, protected bool) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE stages SET is_protected = $1 WHERE id = $2`, protected, id)
	return err
}

// =============================================================================
// INSTANCE METHODS
// =============================================================================

func (s *Store) CreateInstance(ctx context.Context, instance models.Instance) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO instances
			(id, stage_id, type, name, container_id, dsn, memory_mb,
			 backup_schedule, retention_days, created_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, instance.ID, instance.StageID, instance.Type, instance.Name, instance.ContainerID,
		instance.DSN, instance.MemoryMB, instance.BackupSchedule, instance.RetentionDays,
		instance.CreatedAt)
	if err != nil {
		return fmt.Errorf("store: create instance: %w", err)
	}
	return nil
}

func (s *Store) GetInstance(ctx context.Context, id string) (models.Instance, error) {
	instance, err := queryOne[models.Instance](ctx, s.pool, `SELECT * FROM instances WHERE id = $1`, id)
	if err != nil {
		return models.Instance{}, fmt.Errorf("store: get instance %q: %w", id, err)
	}
	return instance, nil
}

func (s *Store) DeleteInstance(ctx context.Context, id string) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM instances WHERE id = $1`, id); err != nil {
		return fmt.Errorf("store: delete instance %q: %w", id, err)
	}
	return nil
}

func (s *Store) GetInstancesForStage(ctx context.Context, stageID string) ([]models.Instance, error) {
	instances, err := queryMany[models.Instance](ctx, s.pool,
		`SELECT * FROM instances WHERE stage_id = $1 ORDER BY created_at`, stageID)
	if err != nil {
		return nil, fmt.Errorf("store: list instances for stage: %w", err)
	}
	return instances, nil
}

func (s *Store) GetInstanceByStageAndName(ctx context.Context, stageID, name string) (models.Instance, error) {
	inst, err := queryOne[models.Instance](ctx, s.pool,
		`SELECT * FROM instances WHERE stage_id = $1 AND name = $2 LIMIT 1`, stageID, name)
	if err != nil {
		return models.Instance{}, fmt.Errorf("store: get instance by stage+name: %w", err)
	}
	return inst, nil
}

// GetInstancesForProject returns all instances for a project, joining through stages.
func (s *Store) GetInstancesForProject(ctx context.Context, projectID string) ([]models.Instance, error) {
	instances, err := queryMany[models.Instance](ctx, s.pool, `
		SELECT i.*
		FROM instances i
		JOIN stages st ON st.id = i.stage_id
		WHERE st.project_id = $1
		ORDER BY i.created_at
	`, projectID)
	if err != nil {
		return nil, fmt.Errorf("store: list instances for project: %w", err)
	}
	return instances, nil
}

// GetProjectForInstance resolves the project that owns a given instance via its stage.
func (s *Store) GetProjectForInstance(ctx context.Context, instanceID string) (models.Project, error) {
	project, err := queryOne[models.Project](ctx, s.pool, `
		SELECT p.*
		FROM projects p
		JOIN stages st ON st.project_id = p.id
		JOIN instances i ON i.stage_id = st.id
		WHERE i.id = $1
		LIMIT 1
	`, instanceID)
	if err != nil {
		return models.Project{}, fmt.Errorf("store: get project for instance: %w", err)
	}
	return project, nil
}

// ── Postgrest methods ─────────────────────────────────────────────────────────

func (s *Store) SetPostgRESTContainer(ctx context.Context, instanceID, containerID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE instances SET postgrest_container_id = $1 WHERE id = $2`,
		containerID, instanceID)
	if err != nil {
		return fmt.Errorf("store: set postgrest container: %w", err)
	}
	return nil
}

func (s *Store) SetAuthenticatorPassword(ctx context.Context, instanceID, password string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE instances SET authenticator_password = $1 WHERE id = $2`,
		password, instanceID)
	if err != nil {
		return fmt.Errorf("store: set authenticator password: %w", err)
	}
	return nil
}

func (s *Store) SetReadonlyDSN(ctx context.Context, instanceID, dsn string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE instances SET readonly_dsn = $1 WHERE id = $2`,
		dsn, instanceID)
	if err != nil {
		return fmt.Errorf("store: set readonly dsn: %w", err)
	}
	return nil
}

func (s *Store) ListPostgresInstancesWithoutPostgREST(ctx context.Context) ([]models.Instance, error) {
	instances, err := queryMany[models.Instance](ctx, s.pool, `
		SELECT * FROM instances
		WHERE type = 'postgres' AND postgrest_container_id = ''
	`)
	if err != nil {
		return nil, fmt.Errorf("store: list pg without postgrest: %w", err)
	}
	return instances, nil
}

// ── Backup methods ────────────────────────────────────────────────────────────

func (s *Store) CreateBackup(ctx context.Context, b models.Backup) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO backups (
			id, instance_id, project_id, type, status, size_bytes,
			minio_key, error, started_at, completed_at, expires_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		)
	`, b.ID, b.InstanceID, b.ProjectID, b.Type, b.Status, b.SizeBytes,
		b.MinioKey, b.Error, b.StartedAt, b.CompletedAt, b.ExpiresAt)
	if err != nil {
		return fmt.Errorf("store: create backup: %w", err)
	}
	return nil
}

func (s *Store) GetBackup(ctx context.Context, id string) (models.Backup, error) {
	b, err := queryOne[models.Backup](ctx, s.pool, `SELECT * FROM backups WHERE id = $1`, id)
	if err != nil {
		return models.Backup{}, fmt.Errorf("store: get backup: %w", err)
	}
	return b, nil
}

func (s *Store) ListBackups(ctx context.Context, instanceID string) ([]models.Backup, error) {
	backups, err := queryMany[models.Backup](ctx, s.pool,
		`SELECT * FROM backups WHERE instance_id = $1 ORDER BY started_at DESC`, instanceID)
	if err != nil {
		return nil, fmt.Errorf("store: list backups: %w", err)
	}
	if backups == nil {
		backups = []models.Backup{}
	}
	return backups, nil
}

func (s *Store) UpdateBackup(ctx context.Context, b models.Backup) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE backups SET
			status       = $1,
			size_bytes   = $2,
			error        = $3,
			completed_at = $4
		WHERE id = $5
	`, b.Status, b.SizeBytes, b.Error, b.CompletedAt, b.ID)
	if err != nil {
		return fmt.Errorf("store: update backup: %w", err)
	}
	return nil
}

func (s *Store) DeleteBackup(ctx context.Context, id string) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM backups WHERE id = $1`, id); err != nil {
		return fmt.Errorf("store: delete backup: %w", err)
	}
	return nil
}

func (s *Store) ListAllInstancesForBackup(ctx context.Context) ([]models.Instance, error) {
	instances, err := queryMany[models.Instance](ctx, s.pool,
		`SELECT * FROM instances
		 WHERE type = 'postgres' AND backup_schedule != 'disabled'
		 ORDER BY created_at`)
	if err != nil {
		return nil, fmt.Errorf("store: list instances for backup: %w", err)
	}
	return instances, nil
}

func (s *Store) GetLatestBackup(ctx context.Context, instanceID string) (*models.Backup, error) {
	b, err := queryOne[models.Backup](ctx, s.pool, `
		SELECT * FROM backups
		WHERE instance_id = $1 AND status = 'completed'
		ORDER BY started_at DESC LIMIT 1
	`, instanceID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("store: get latest backup: %w", err)
	}
	return &b, nil
}

func (s *Store) ListExpiredBackups(ctx context.Context) ([]models.Backup, error) {
	backups, err := queryMany[models.Backup](ctx, s.pool,
		`SELECT * FROM backups
		 WHERE expires_at < CURRENT_TIMESTAMP AND status = 'completed'`)
	if err != nil {
		return nil, fmt.Errorf("store: list expired backups: %w", err)
	}
	return backups, nil
}

func (s *Store) UpdateInstanceBackupSettings(
	ctx context.Context,
	id, schedule string,
	retentionDays int,
) error {
	if _, err := s.pool.Exec(ctx,
		`UPDATE instances SET backup_schedule = $1, retention_days = $2 WHERE id = $3`,
		schedule, retentionDays, id); err != nil {
		return fmt.Errorf("store: update backup settings: %w", err)
	}
	return nil
}

// =============================================================================
// API KEY METHODS
// =============================================================================

func (s *Store) CreateAPIKey(ctx context.Context, k models.APIKey) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO project_api_keys
			(id, project_id, type, key_prefix, key_hash, created_at)
		VALUES
			($1, $2, $3, $4, $5, $6)
	`, k.ID, k.ProjectID, k.Type, k.KeyPrefix, k.KeyHash, k.CreatedAt)
	if err != nil {
		return fmt.Errorf("store: create api key: %w", err)
	}
	return nil
}

func (s *Store) GetAPIKeysForProject(ctx context.Context, projectID string) ([]models.APIKey, error) {
	keys, err := queryMany[models.APIKey](ctx, s.pool, `
		SELECT * FROM project_api_keys
		WHERE project_id = $1 AND revoked_at IS NULL
		ORDER BY type
	`, projectID)
	if err != nil {
		return nil, fmt.Errorf("store: list api keys: %w", err)
	}
	return keys, nil
}

func (s *Store) GetAPIKeyByPrefix(ctx context.Context, prefix string) (models.APIKey, error) {
	k, err := queryOne[models.APIKey](ctx, s.pool, `
		SELECT * FROM project_api_keys
		WHERE key_prefix = $1 AND revoked_at IS NULL
		LIMIT 1
	`, prefix)
	if err != nil {
		return models.APIKey{}, fmt.Errorf("store: get api key by prefix: %w", err)
	}
	return k, nil
}

func (s *Store) RevokeAPIKey(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE project_api_keys
		SET revoked_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("store: revoke key: %w", err)
	}
	return nil
}

func (s *Store) TouchAPIKeyUsage(ctx context.Context, id string) error {
	s.pool.Exec(ctx, `
		UPDATE project_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1
	`, id)
	return nil
}

func (s *Store) SetProjectSigningSecret(ctx context.Context, id, secret string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE projects SET jwt_signing_secret = $1 WHERE id = $2`, secret, id)
	if err != nil {
		return fmt.Errorf("store: set project signing secret: %w", err)
	}
	return nil
}

// =============================================================================
// BUCKET METHODS
// =============================================================================

func (s *Store) CreateBucket(ctx context.Context, bucket models.Bucket) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO buckets (id, project_id, name, public, size_bytes, file_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, bucket.ID, bucket.ProjectID, bucket.Name, bucket.Public, bucket.SizeBytes,
		bucket.FileCount, bucket.CreatedAt)
	if err != nil {
		return fmt.Errorf("store: create bucket: %w", err)
	}
	return nil
}

func (s *Store) GetBucketByName(ctx context.Context, name string) (models.Bucket, error) {
	bucket, err := queryOne[models.Bucket](ctx, s.pool, `SELECT * FROM buckets WHERE name = $1`, name)
	if err != nil {
		return models.Bucket{}, fmt.Errorf("store: get bucket: %w", err)
	}
	return bucket, nil
}

func (s *Store) ListBuckets(ctx context.Context, projectID string) ([]models.Bucket, error) {
	buckets, err := queryMany[models.Bucket](ctx, s.pool,
		`SELECT * FROM buckets WHERE project_id = $1 ORDER BY created_at DESC`, projectID)
	if err != nil {
		return nil, fmt.Errorf("store: list buckets: %w", err)
	}
	if buckets == nil {
		buckets = []models.Bucket{}
	}
	return buckets, nil
}

func (s *Store) DeleteBucket(ctx context.Context, id string) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM buckets WHERE id = $1`, id); err != nil {
		return fmt.Errorf("store: delete bucket: %w", err)
	}
	return nil
}

func (s *Store) UpdateBucketPublic(ctx context.Context, id string, public bool) error {
	if _, err := s.pool.Exec(ctx,
		`UPDATE buckets SET public = $1 WHERE id = $2`, public, id); err != nil {
		return fmt.Errorf("store: update bucket public: %w", err)
	}
	return nil
}

func (s *Store) RenameBucket(ctx context.Context, id, newName string) error {
	if _, err := s.pool.Exec(ctx,
		`UPDATE buckets SET name = $1 WHERE id = $2`, newName, id); err != nil {
		return fmt.Errorf("store: rename bucket: %w", err)
	}
	return nil
}

func (s *Store) CreateDownloadToken(ctx context.Context, token, bucket, key string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO download_tokens (token, bucket, key, expires_at) VALUES ($1, $2, $3, $4)`,
		token, bucket, key, expiresAt)
	if err != nil {
		return fmt.Errorf("store: create download token: %w", err)
	}
	return nil
}

func (s *Store) GetDownloadToken(ctx context.Context, token string) (models.DownloadToken, error) {
	tok, err := queryOne[models.DownloadToken](ctx, s.pool,
		`SELECT * FROM download_tokens WHERE token = $1`, token)
	if err != nil {
		return models.DownloadToken{}, fmt.Errorf("store: get download token: %w", err)
	}
	return tok, nil
}

func (s *Store) DeleteDownloadToken(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM download_tokens WHERE token = $1`, token)
	return err
}

func (s *Store) DeleteExpiredTokens(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM download_tokens WHERE expires_at <= CURRENT_TIMESTAMP`)
	return err
}

func (s *Store) UpdateBucketStats(ctx context.Context, id string, sizeBytes, fileCount int64) error {
	if _, err := s.pool.Exec(ctx,
		`UPDATE buckets SET size_bytes = $1, file_count = $2 WHERE id = $3`,
		sizeBytes, fileCount, id); err != nil {
		return fmt.Errorf("store: update bucket stats: %w", err)
	}
	return nil
}

func (s *Store) IncrBucketStatsByName(ctx context.Context, name string, sizeDelta, countDelta int64) error {
	if _, err := s.pool.Exec(ctx,
		`UPDATE buckets
		 SET size_bytes = GREATEST(0, size_bytes + $1),
		     file_count = GREATEST(0, file_count + $2)
		 WHERE name = $3`,
		sizeDelta, countDelta, name); err != nil {
		return fmt.Errorf("store: incr bucket stats: %w", err)
	}
	return nil
}

// LogInstancesWithInvalidNames is a no-op kept for startup compatibility.
func (s *Store) LogInstancesWithInvalidNames(_ context.Context) error {
	slog.Info("store: instance name validation skipped (stage model active)")
	return nil
}

// =============================================================================
// METRICS SOURCE (metrics.Source)
// =============================================================================

func (s *Store) ListProjectRefs(ctx context.Context) ([]metrics.ProjectRef, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, slug FROM projects`)
	if err != nil {
		return nil, fmt.Errorf("store: list project refs: %w", err)
	}
	defer rows.Close()
	var out []metrics.ProjectRef
	for rows.Next() {
		var p metrics.ProjectRef
		if err := rows.Scan(&p.ID, &p.Slug); err != nil {
			return nil, fmt.Errorf("store: scan project ref: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ListBucketRefs(ctx context.Context) ([]metrics.BucketRef, error) {
	rows, err := s.pool.Query(ctx, `SELECT b.name, p.slug FROM buckets b JOIN projects p ON p.id = b.project_id`)
	if err != nil {
		return nil, fmt.Errorf("store: list bucket refs: %w", err)
	}
	defer rows.Close()
	var out []metrics.BucketRef
	for rows.Next() {
		var b metrics.BucketRef
		if err := rows.Scan(&b.Name, &b.ProjectSlug); err != nil {
			return nil, fmt.Errorf("store: scan bucket ref: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
