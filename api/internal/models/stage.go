package models

import (
	"fmt"
	"time"
)

type Stage struct {
	ID          string    `json:"id"           db:"id"`
	ProjectID   string    `json:"project_id"   db:"project_id"`
	Name        string    `json:"name"         db:"name"`
	IsProtected bool      `json:"is_protected" db:"is_protected"`
	CreatedAt   time.Time `json:"created_at"   db:"created_at"`
}

type CreateStageRequest struct {
	Name            string                         `json:"name"`
	IsProtected     bool                           `json:"is_protected"`
	InitialInstance *CreateInstanceForStageRequest `json:"initial_instance,omitempty"`
}

// CreateInstanceForStageRequest is used when creating an instance within a stage,
// either as the initial_instance on stage creation or via the add-instance endpoint.
type CreateInstanceForStageRequest struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	MemoryMB     int    `json:"memory_mb"`
	SchemaPreset string `json:"schema_preset"`
}

var reservedStageNames = map[string]bool{
	"auth": true, "rest": true, "api": true, "admin": true,
	"v1": true, "system": true, "public": true,
	"db": true, "stage": true, "stages": true,
}

func ValidateStageName(name string) error {
	if name == "" {
		return fmt.Errorf("stage name is required")
	}
	if !instanceNameRegex.MatchString(name) {
		return fmt.Errorf("stage name must be lowercase, start with a letter, " +
			"and contain only letters, digits, hyphens, or underscores (max 63 chars)")
	}
	if reservedStageNames[name] {
		return fmt.Errorf("stage name %q is reserved", name)
	}
	return nil
}
