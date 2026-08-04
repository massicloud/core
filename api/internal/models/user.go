package models

import "time"

type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleViewer UserRole = "viewer"
)

type User struct {
	ID        string    `json:"id"         db:"id"`
	Email     string    `json:"email"      db:"email"`
	Password  string    `json:"-"          db:"password"`
	FullName  string    `json:"full_name"  db:"full_name"`
	Role      UserRole  `json:"role"       db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Claims struct {
	UserID string   `json:"user_id"`
	Email  string   `json:"email"`
	Role   UserRole `json:"role"`
}
