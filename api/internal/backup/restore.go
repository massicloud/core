package backup

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"

	"github.com/mikaminou/massicloud/api/internal/models"
)

// Restore downloads a completed backup from MinIO and pipes it into
// newInstance via a local pg_restore subprocess connecting over its DSN.
// The source instance is never touched; only newInstance is written to.
func (s *Service) Restore(
	ctx context.Context,
	backupID string,
	newInstance models.Instance,
) error {
	b, err := s.store.GetBackup(ctx, backupID)
	if err != nil {
		return fmt.Errorf("restore: get backup: %w", err)
	}

	if b.Status != models.BackupCompleted {
		return fmt.Errorf("restore: backup %s is not completed (status: %s)", backupID, b.Status)
	}

	s.logger.Info("restore started",
		slog.String("backup_id", backupID),
		slog.String("new_instance_id", newInstance.ID),
	)

	// Download backup stream from MinIO.
	obj, _, err := s.storage.GetObject(ctx, BackupBucket, b.MinioKey)
	if err != nil {
		return fmt.Errorf("restore: download backup: %w", err)
	}
	defer obj.Close()

	cmd := exec.CommandContext(ctx, "pg_restore",
		"--no-owner",
		"--no-privileges",
		"--clean",
		"--if-exists",
		"--dbname="+newInstance.DSN,
	)
	cmd.Stdin = obj
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("restore: pg_restore: %w: %s", err, strings.TrimSpace(stderr.String()))
	}

	s.logger.Info("restore completed",
		slog.String("backup_id", backupID),
		slog.String("new_instance_id", newInstance.ID),
	)

	return nil
}
