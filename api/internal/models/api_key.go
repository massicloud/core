package models

import "time"

type APIKeyType string

const (
	APIKeyAnon    APIKeyType = "anon"
	APIKeyService APIKeyType = "service"
)

type APIKey struct {
	ID         string     `json:"id"           db:"id"`
	ProjectID  string     `json:"project_id"   db:"project_id"`
	Type       APIKeyType `json:"type"         db:"type"`
	KeyPrefix  string     `json:"key_prefix"   db:"key_prefix"`
	KeyHash    string     `json:"-"            db:"key_hash"`
	CreatedAt  time.Time  `json:"created_at"   db:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at" db:"last_used_at"`
	RevokedAt  *time.Time `json:"revoked_at"   db:"revoked_at"`
}

// APIKeyWithSecret is returned ONLY at creation time and after rotation.
// The full key value is never stored or returned again.
type APIKeyWithSecret struct {
	APIKey
	FullKey string `json:"full_key"`
}
