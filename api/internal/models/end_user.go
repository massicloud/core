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

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetResponse struct {
	// TEMPORARY: populated directly until email delivery exists. Omitted
	// entirely when the email doesn't match a registered user.
	ResetToken string `json:"reset_token,omitempty"`
	Note       string `json:"note,omitempty"`
	Message    string `json:"message"`
}

type PasswordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}
