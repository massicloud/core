package models

import "time"

type BackupType string

const (
	BackupManual    BackupType = "manual"
	BackupScheduled BackupType = "scheduled"
)

type BackupStatus string

const (
	BackupPending   BackupStatus = "pending"
	BackupRunning   BackupStatus = "running"
	BackupCompleted BackupStatus = "completed"
	BackupFailed    BackupStatus = "failed"
)

type Backup struct {
	ID          string       `json:"id"           db:"id"`
	InstanceID  string       `json:"instance_id"  db:"instance_id"`
	ProjectID   string       `json:"project_id"   db:"project_id"`
	Type        BackupType   `json:"type"         db:"type"`
	Status      BackupStatus `json:"status"       db:"status"`
	SizeBytes   int64        `json:"size_bytes"   db:"size_bytes"`
	MinioKey    string       `json:"minio_key"    db:"minio_key"`
	Error       string       `json:"error"        db:"error"`
	StartedAt   time.Time    `json:"started_at"   db:"started_at"`
	CompletedAt *time.Time   `json:"completed_at" db:"completed_at"`
	ExpiresAt   time.Time    `json:"expires_at"   db:"expires_at"`
}

type RestoreRequest struct {
	BackupID string `json:"backup_id"`
	StageID  string `json:"stage_id"`
	NewName  string `json:"new_name"`
	MemoryMB int    `json:"memory_mb"`
}

type UpdateBackupSettingsRequest struct {
	BackupSchedule string `json:"backup_schedule"`
	RetentionDays  int    `json:"retention_days"`
}
