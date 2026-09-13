package models

import "time"

type InstanceStatus string

const (
	StatusRunning InstanceStatus = "running"
	StatusStopped InstanceStatus = "stopped"
	StatusError   InstanceStatus = "error"
)

type Instance struct {
	ID                    string    `json:"id"             db:"id"`
	StageID               string    `json:"stage_id"       db:"stage_id"`
	Type                  string    `json:"type"           db:"type"`
	Name                  string    `json:"name"           db:"name"`
	ContainerID           string    `json:"-"              db:"container_id"`
	DSN                   string    `json:"-"              db:"dsn"`
	MemoryMB              int       `json:"memory_mb"      db:"memory_mb"`
	BackupSchedule        string    `json:"backup_schedule" db:"backup_schedule"`
	RetentionDays         int       `json:"retention_days" db:"retention_days"`
	PostgRESTContainerID  string    `json:"-"              db:"postgrest_container_id"`
	AuthenticatorPassword string    `json:"-"              db:"authenticator_password"`
	ReadonlyDSN           string    `json:"-"              db:"readonly_dsn"`
	CreatedAt             time.Time `json:"created_at"     db:"created_at"`
}
