package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/mikaminou/massicloud/api/internal/email"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/store"
)

const (
	platformResetTokenTTL = time.Hour
	platformResetMessage  = "if an account exists for this email, a reset link has been sent"
	minPasswordLen        = 8 // matches auth.Service.Register
)

// platformResetStore is the slice of *store.Store the platform reset flow
// needs; an interface so handler tests can use a fake.
type platformResetStore interface {
	GetUserByEmail(ctx context.Context, email string) (models.User, error)
	CreatePlatformResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error
	FindValidPlatformResetToken(ctx context.Context, tokenHash string) (tokenID, userID string, err error)
	ApplyPlatformPasswordReset(ctx context.Context, tokenID, userID, passwordHash string) error
}

var _ platformResetStore = (*store.Store)(nil)

// generateResetToken returns 32 random bytes as 64 hex chars.
func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashResetToken returns the hex SHA-256 of the raw token — the only form
// that is ever stored.
func hashResetToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// RequestPlatformPasswordReset POST /auth/reset-password
//
// Always answers 200 with the same message so it can't be used to enumerate
// accounts. The email is sent in the background so response time doesn't
// reveal whether the account exists either.
func (h *Handler) RequestPlatformPasswordReset(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	addr := strings.TrimSpace(req.Email)
	if parsed, err := mail.ParseAddress(addr); err != nil || parsed.Address != addr {
		h.writeError(w, http.StatusBadRequest, "invalid email address")
		return
	}

	respond := func() {
		h.writeJSON(w, http.StatusOK, map[string]string{"message": platformResetMessage})
	}

	user, err := h.resetStore.GetUserByEmail(ctx, addr)
	if err != nil {
		// Not found (or lookup failure): same response, no insert, no email.
		respond()
		return
	}

	raw, err := generateResetToken()
	if err != nil {
		h.logger.Error("platform reset: generate token failed", slog.Any("error", err))
		respond()
		return
	}
	if err := h.resetStore.CreatePlatformResetToken(ctx, user.ID, hashResetToken(raw), time.Now().Add(platformResetTokenTTL)); err != nil {
		h.logger.Error("platform reset: store token failed", slog.String("user_id", user.ID), slog.Any("error", err))
		respond()
		return
	}

	resetURL := strings.TrimRight(h.config.PortalURL, "/") + "/reset?token=" + url.QueryEscape(raw)
	htmlBody, textBody, err := email.RenderPasswordReset(email.PasswordResetData{
		FullName: user.FullName,
		ResetURL: resetURL,
	})
	if err != nil {
		h.logger.Error("platform reset: render email failed", slog.Any("error", err))
		respond()
		return
	}

	msg := email.Message{
		To:       user.Email,
		Subject:  "Reset your MassiCloud password",
		HTMLBody: htmlBody,
		TextBody: textBody,
	}
	go func() {
		sendCtx, sendCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer sendCancel()
		if err := h.emailSender.Send(sendCtx, msg); err != nil {
			// Delivery status is never leaked to the client.
			h.logger.Error("platform reset: send email failed",
				slog.String("user_id", user.ID), slog.Any("error", err))
		}
	}()

	respond()
}

// ConfirmPlatformPasswordReset POST /auth/reset-password/confirm
func (h *Handler) ConfirmPlatformPasswordReset(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.NewPassword) < minPasswordLen {
		h.writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	// bcrypt silently truncates past 72 bytes; GenerateFromPassword rejects
	// them outright in current x/crypto, so surface that as a 400.
	if len(req.NewPassword) > 72 {
		h.writeError(w, http.StatusBadRequest, "password must be at most 72 bytes")
		return
	}

	const invalid = "invalid or expired reset token"
	if req.Token == "" {
		h.writeError(w, http.StatusBadRequest, invalid)
		return
	}

	tokenID, userID, err := h.resetStore.FindValidPlatformResetToken(ctx, hashResetToken(req.Token))
	if err != nil {
		if !errors.Is(err, store.ErrInvalidResetToken) {
			h.logger.Error("platform reset: token lookup failed", slog.Any("error", err))
		}
		h.writeError(w, http.StatusBadRequest, invalid)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		h.logger.Error("platform reset: hash password failed", slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	if err := h.resetStore.ApplyPlatformPasswordReset(ctx, tokenID, userID, string(hash)); err != nil {
		if errors.Is(err, store.ErrInvalidResetToken) {
			h.writeError(w, http.StatusBadRequest, invalid)
			return
		}
		h.logger.Error("platform reset: apply failed", slog.String("user_id", userID), slog.Any("error", err))
		h.writeError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	h.logger.Info("platform password reset", slog.String("user_id", userID))
	h.writeJSON(w, http.StatusOK, map[string]string{"message": "password reset successful"})
}
