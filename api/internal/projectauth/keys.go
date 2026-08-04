package projectauth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/mikaminou/massicloud/api/internal/models"
)

// GenerateAPIKey creates a new API key of the given type.
// Returns the full key (only shown once) and its bcrypt hash for storage.
//
// Format: mc_{type}_{32 random bytes, base64url}
func GenerateAPIKey(keyType models.APIKeyType) (full, hash, prefix string, err error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", "", fmt.Errorf("rand read: %w", err)
	}

	encoded := base64.RawURLEncoding.EncodeToString(randomBytes)
	full = fmt.Sprintf("mc_%s_%s", keyType, encoded)

	hashed, err := bcrypt.GenerateFromPassword([]byte(full), bcrypt.DefaultCost)
	if err != nil {
		return "", "", "", fmt.Errorf("bcrypt: %w", err)
	}
	hash = string(hashed)

	// Prefix = first 16 chars, used for display/lookup. Safe to log.
	if len(full) > 16 {
		prefix = full[:16]
	} else {
		prefix = full
	}

	return full, hash, prefix, nil
}

// VerifyAPIKey checks a presented key against the stored bcrypt hash.
func VerifyAPIKey(presented, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(presented)) == nil
}

// GenerateSigningSecret produces a 64-byte secret for JWT signing per project.
func GenerateSigningSecret() (string, error) {
	b := make([]byte, 64)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("rand read: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
