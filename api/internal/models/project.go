package models

import "time"

type Project struct {
	ID               string    `json:"id"          db:"id"`
	Name             string    `json:"name"        db:"name"`
	Slug             string    `json:"slug"        db:"slug"`
	Description      string    `json:"description" db:"description"`
	UserID           string    `json:"user_id"     db:"user_id"`
	JWTSigningSecret string    `json:"-"           db:"jwt_signing_secret"`
	CreatedAt        time.Time `json:"created_at"  db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"  db:"updated_at"`
}

type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}
