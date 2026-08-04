package projectauth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	AccessTokenTTL  = 1 * time.Hour
	RefreshTokenTTL = 30 * 24 * time.Hour
)

// EndUserClaims is embedded in tokens issued to end-users.
// Format matches Supabase/PostgREST conventions so the same JWT works
// when PostgREST is added later.
type EndUserClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"` // 'authenticated' or 'anon'
	Aud   string `json:"aud"` // project ID
	Type  string `json:"type"` // 'access' or 'refresh'
	jwt.RegisteredClaims
}

func IssueAccessToken(projectID, userID, email, signingSecret string) (string, error) {
	claims := EndUserClaims{
		Sub:   userID,
		Email: email,
		Role:  "authenticated",
		Aud:   projectID,
		Type:  "access",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenTTL)),
			Issuer:    "massicloud",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(signingSecret))
}

func IssueRefreshToken(projectID, userID, signingSecret string) (string, error) {
	claims := EndUserClaims{
		Sub:  userID,
		Aud:  projectID,
		Role: "authenticated",
		Type: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(RefreshTokenTTL)),
			Issuer:    "massicloud",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(signingSecret))
}

func ParseToken(tokenStr, signingSecret string) (*EndUserClaims, error) {
	claims := &EndUserClaims{}

	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(signingSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	return claims, nil
}
