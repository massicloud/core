package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrInvalidResetToken means the token doesn't exist, is expired, or was
// already used.
var ErrInvalidResetToken = errors.New("store: invalid or expired reset token")

// CreatePlatformResetToken stores the SHA-256 hex hash of a reset token.
func (s *Store) CreatePlatformResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO platform_password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("store: create platform reset token: %w", err)
	}
	return nil
}

// FindValidPlatformResetToken returns the token row id and owning user id for
// an unused, unexpired token hash, or ErrInvalidResetToken.
func (s *Store) FindValidPlatformResetToken(ctx context.Context, tokenHash string) (tokenID, userID string, err error) {
	err = s.pool.QueryRow(ctx, `
		SELECT id::text, user_id FROM platform_password_reset_tokens
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
	`, tokenHash).Scan(&tokenID, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrInvalidResetToken
	}
	if err != nil {
		return "", "", fmt.Errorf("store: find platform reset token: %w", err)
	}
	return tokenID, userID, nil
}

// ApplyPlatformPasswordReset atomically marks the token used, sets the user's
// password hash, and invalidates the user's other outstanding reset tokens.
// The token is re-checked inside the transaction, so a concurrent second
// confirm with the same token gets ErrInvalidResetToken.
func (s *Store) ApplyPlatformPasswordReset(ctx context.Context, tokenID, userID, passwordHash string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin reset tx: %w", err)
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE platform_password_reset_tokens SET used_at = NOW()
		WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()
	`, tokenID)
	if err != nil {
		return fmt.Errorf("store: mark reset token used: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrInvalidResetToken
	}

	if _, err := tx.Exec(ctx, `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
		passwordHash, userID); err != nil {
		return fmt.Errorf("store: update password: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE platform_password_reset_tokens SET used_at = NOW()
		WHERE user_id = $1 AND used_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("store: invalidate other reset tokens: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit reset tx: %w", err)
	}
	return nil
}
