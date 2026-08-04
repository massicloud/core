package backup

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/storage"
	"github.com/mikaminou/massicloud/api/internal/store"
)

const BackupBucket = "massicloud-backups"

type Service struct {
	store   *store.Store
	storage *storage.Client
	logger  *slog.Logger
}

func New(
	store *store.Store,
	storage *storage.Client,
	logger *slog.Logger,
) *Service {
	return &Service{
		store:   store,
		storage: storage,
		logger:  logger,
	}
}

// EnsureBucket creates the backup bucket if it doesn't exist. Call once at startup.
func (s *Service) EnsureBucket(ctx context.Context) error {
	if err := s.storage.EnsureBucket(ctx, BackupBucket); err != nil {
		return fmt.Errorf("backup: ensure bucket: %w", err)
	}
	return nil
}

// CreateBackup runs pg_dump against the instance's DSN and streams the result
// to MinIO. Status is persisted at each stage. Safe to call concurrently.
func (s *Service) CreateBackup(
	ctx context.Context,
	instance models.Instance,
	backupType models.BackupType,
) (models.Backup, error) {
	backupID := uuid.New().String()
	minioKey := fmt.Sprintf("%s/%s.dump", instance.ID, backupID)

	retention := instance.RetentionDays
	if retention <= 0 {
		retention = 7
	}
	expiresAt := time.Now().Add(time.Duration(retention) * 24 * time.Hour)

	projectID := ""
	if proj, projErr := s.store.GetProjectForInstance(ctx, instance.ID); projErr == nil {
		projectID = proj.ID
	}

	b := models.Backup{
		ID:         backupID,
		InstanceID: instance.ID,
		ProjectID:  projectID,
		Type:       backupType,
		Status:     models.BackupRunning,
		MinioKey:   minioKey,
		StartedAt:  time.Now(),
		ExpiresAt:  expiresAt,
	}

	if err := s.store.CreateBackup(ctx, b); err != nil {
		return models.Backup{}, fmt.Errorf("backup: save initial record: %w", err)
	}

	s.logger.Info("backup started",
		slog.String("backup_id", backupID),
		slog.String("instance_id", instance.ID),
		slog.String("type", string(backupType)),
	)

	size, err := s.dumpToMinio(ctx, instance, minioKey)
	completedAt := time.Now()

	if err != nil {
		b.Status = models.BackupFailed
		b.Error = err.Error()
		b.CompletedAt = &completedAt
		_ = s.store.UpdateBackup(ctx, b)
		s.logger.Error("backup failed",
			slog.String("backup_id", backupID),
			slog.Any("error", err),
		)
		return b, fmt.Errorf("backup: dump: %w", err)
	}

	b.Status = models.BackupCompleted
	b.SizeBytes = size
	b.CompletedAt = &completedAt
	if err := s.store.UpdateBackup(ctx, b); err != nil {
		return b, fmt.Errorf("backup: update completed record: %w", err)
	}

	s.logger.Info("backup completed",
		slog.String("backup_id", backupID),
		slog.Int64("size_bytes", size),
		slog.Duration("duration", completedAt.Sub(b.StartedAt)),
	)

	return b, nil
}

// dumpToMinio runs pg_dump as a local subprocess against the instance's DSN
// (a network client, same as any other Postgres client — it doesn't need to
// run inside the tenant pod) and pipes its stdout to MinIO.
func (s *Service) dumpToMinio(
	ctx context.Context,
	instance models.Instance,
	minioKey string,
) (int64, error) {
	cmd := exec.CommandContext(ctx, "pg_dump",
		"--format=custom",
		"--no-owner",
		"--no-privileges",
		"--compress=6",
		"--dbname="+instance.DSN,
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return 0, fmt.Errorf("stdout pipe: %w", err)
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		return 0, fmt.Errorf("start pg_dump: %w", err)
	}

	// Must fully drain stdout before Wait — see exec.Cmd.StdoutPipe docs.
	obj, uploadErr := s.storage.UploadObjectStream(ctx, BackupBucket, minioKey, stdout, "application/octet-stream")
	waitErr := cmd.Wait()

	if waitErr != nil {
		return 0, fmt.Errorf("pg_dump: %w: %s", waitErr, strings.TrimSpace(stderr.String()))
	}
	if uploadErr != nil {
		return 0, fmt.Errorf("minio upload: %w", uploadErr)
	}

	return obj.Size, nil
}

// DeleteBackup removes the object from MinIO and the record from the store.
func (s *Service) DeleteBackup(ctx context.Context, backupID string) error {
	b, err := s.store.GetBackup(ctx, backupID)
	if err != nil {
		return fmt.Errorf("backup: get record: %w", err)
	}

	if b.MinioKey != "" {
		if err := s.storage.DeleteObject(ctx, BackupBucket, b.MinioKey); err != nil {
			s.logger.Warn("backup: failed to delete object from minio",
				slog.String("key", b.MinioKey),
				slog.Any("error", err),
			)
			// Continue — always remove the DB record.
		}
	}

	if err := s.store.DeleteBackup(ctx, backupID); err != nil {
		return fmt.Errorf("backup: delete record: %w", err)
	}

	s.logger.Info("backup deleted", slog.String("backup_id", backupID))
	return nil
}

// CleanupExpired deletes all backups past their retention date.
// Returns the number of backups deleted.
func (s *Service) CleanupExpired(ctx context.Context) (int, error) {
	expired, err := s.store.ListExpiredBackups(ctx)
	if err != nil {
		return 0, fmt.Errorf("backup: list expired: %w", err)
	}

	count := 0
	for _, b := range expired {
		if err := s.DeleteBackup(ctx, b.ID); err != nil {
			s.logger.Error("cleanup: failed to delete backup",
				slog.String("backup_id", b.ID),
				slog.Any("error", err),
			)
			continue
		}
		count++
	}

	if count > 0 {
		s.logger.Info("backup cleanup completed", slog.Int("deleted", count))
	}
	return count, nil
}
