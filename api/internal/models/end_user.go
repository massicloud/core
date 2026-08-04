package models

import "time"

// EndUser represents a customer of a tenant's app.
// Stored in the tenant's own Postgres (auth.users table).
type EndUser struct {
	ID         string     `json:"id"`
	Email      string     `json:"email"`
	CreatedAt  time.Time  `json:"created_at"`
	LastSignIn *time.Time `json:"last_sign_in_at"`
}

type SignUpRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	User         EndUser `json:"user"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	ExpiresIn    int     `json:"expires_in"`
	TokenType    string  `json:"token_type"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}
