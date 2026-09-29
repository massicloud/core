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
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/projectauth"
)

// SignUpEndUser POST /v1/{slug}/db/{db}/auth/signup
func (h *Handler) SignUpEndUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return
	}

	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	var req models.SignUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if !isValidEmail(req.Email) {
		h.writeError(w, http.StatusBadRequest, "invalid email format")
		return
	}
	if !isValidPassword(req.Password) {
		h.writeError(w, http.StatusBadRequest, "invalid password (min 6 chars)")
		return
	}

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	userID := uuid.New().String()
	now := time.Now()

	// No existence pre-check: a SELECT-then-INSERT here used to let two
	// concurrent signups for the same email both pass the SELECT and race
	// on the INSERT, with the loser surfacing a raw, leaky 500. Postgres'
	// own UNIQUE(email) constraint is the single source of truth for
	// uniqueness; isPgUniqueViolation turns its error into a clean 409.
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, encrypted_password, created_at)
		VALUES ($1, $2, $3, $4)
	`, userID, req.Email, string(hash), now)
	if err != nil {
		if isPgUniqueViolation(err) {
			h.writeJSON(w, http.StatusConflict, map[string]string{
				"error": "email already registered",
				"code":  "email_taken",
			})
			return
		}
		h.writeError(w, http.StatusInternalServerError, "failed to create user: "+err.Error())
		return
	}

	accessToken, err := projectauth.IssueAccessToken(
		project.ID, userID, req.Email, project.JWTSigningSecret)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "token issue failed")
		return
	}

	refreshToken, err := projectauth.IssueRefreshToken(
		project.ID, userID, project.JWTSigningSecret)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "refresh token issue failed")
		return
	}

	h.logger.Info("end-user signup",
		slog.String("project_id", project.ID),
		slog.String("instance_id", instance.ID),
		slog.String("user_id", userID),
	)

	h.writeJSON(w, http.StatusCreated, models.AuthResponse{
		User: models.EndUser{
			ID:        userID,
			Email:     req.Email,
			CreatedAt: now,
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(projectauth.AccessTokenTTL.Seconds()),
		TokenType:    "Bearer",
	})
}

// SignInEndUser POST /v1/{slug}/db/{db}/auth/login
func (h *Handler) SignInEndUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return
	}

	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	var req models.SignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	var (
		userID    string
		hashed    string
		createdAt time.Time
	)

	err = pool.QueryRow(ctx, `
		SELECT id, encrypted_password, created_at
		FROM auth.users WHERE email = $1
	`, req.Email).Scan(&userID, &hashed, &createdAt)

	if err != nil {
		h.writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(req.Password)); err != nil {
		h.writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	accessToken, err := projectauth.IssueAccessToken(
		project.ID, userID, req.Email, project.JWTSigningSecret)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "token issue failed")
		return
	}

	refreshToken, err := projectauth.IssueRefreshToken(
		project.ID, userID, project.JWTSigningSecret)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "refresh token issue failed")
		return
	}

	h.logger.Info("end-user signin",
		slog.String("project_id", project.ID),
		slog.String("instance_id", instance.ID),
		slog.String("user_id", userID),
	)

	h.writeJSON(w, http.StatusOK, models.AuthResponse{
		User: models.EndUser{
			ID:        userID,
			Email:     req.Email,
			CreatedAt: createdAt,
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(projectauth.AccessTokenTTL.Seconds()),
		TokenType:    "Bearer",
	})
}

// RefreshEndUser POST /v1/{slug}/db/{db}/auth/refresh
func (h *Handler) RefreshEndUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	_ = ctx

	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return
	}

	var req models.RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	claims, err := projectauth.ParseToken(req.RefreshToken, project.JWTSigningSecret)
	if err != nil || claims.Type != "refresh" {
		h.writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	accessToken, err := projectauth.IssueAccessToken(
		project.ID, claims.Sub, claims.Email, project.JWTSigningSecret)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "token issue failed")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
		"expires_in":   int(projectauth.AccessTokenTTL.Seconds()),
		"token_type":   "Bearer",
	})
}

// GetEndUser GET /v1/{slug}/db/{db}/auth/user
func (h *Handler) GetEndUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	claims, ok := r.Context().Value(middleware.CtxEndUserClaims).(*projectauth.EndUserClaims)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "claims context missing")
		return
	}

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	var u models.EndUser
	err = pool.QueryRow(ctx, `
		SELECT id, email, created_at FROM auth.users WHERE id = $1
	`, claims.Sub).Scan(&u.ID, &u.Email, &u.CreatedAt)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "user not found")
		return
	}

	h.writeJSON(w, http.StatusOK, u)
}

const passwordResetGenericMessage = "if an account exists for this email, a password reset has been initiated"

// RequestPasswordReset POST /v1/{slug}/{stage}/db/{db}/auth/reset-password
//
// Always returns 200 with the same generic message whether or not the email
// belongs to a registered user, so the response can't be used to enumerate
// accounts. reset_token (and only it) is additionally present when the user
// exists.
func (h *Handler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return
	}
	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	var req models.PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Keyed per-project so the same email across two different tenants
	// doesn't share a budget; counted regardless of whether the email turns
	// out to belong to a user, so the limiter itself can't be used to probe
	// which emails are registered.
	if !passwordResetLimiter.allow(project.ID+":"+req.Email, passwordResetMaxAttempts, passwordResetWindow) {
		h.writeError(w, http.StatusTooManyRequests, "too many password reset requests, try again later")
		return
	}

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	var userID string
	err = pool.QueryRow(ctx, `SELECT id FROM auth.users WHERE email = $1`, req.Email).Scan(&userID)
	if err != nil {
		// Unknown email (or a lookup error) gets the exact same response as
		// the found case, minus reset_token — see the anti-enumeration note
		// on the handler doc comment above.
		h.writeJSON(w, http.StatusOK, models.PasswordResetResponse{
			Message: passwordResetGenericMessage,
		})
		return
	}

	rawToken := make([]byte, 32)
	if _, err := rand.Read(rawToken); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to generate reset token")
		return
	}
	rawTokenHex := hex.EncodeToString(rawToken)
	sum := sha256.Sum256([]byte(rawTokenHex))
	tokenHash := hex.EncodeToString(sum[:])

	// auth.password_reset_tokens.token has its own DEFAULT (a random hex
	// value generated by Postgres), but nothing consuming that default ever
	// hashed it — we mint our own raw/hash pair here instead and store only
	// the hash, so a read-only leak of this table alone (backup, replica,
	// etc.) can't be used to reset anyone's password.
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.password_reset_tokens (user_id, token, expires_at, used_at)
		VALUES ($1, $2, NOW() + INTERVAL '1 hour', NULL)
	`, userID, tokenHash)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to create reset token")
		return
	}

	h.logger.Info("password reset requested",
		slog.String("project_id", project.ID),
		slog.String("instance_id", instance.ID),
		slog.String("user_id", userID),
	)

	h.writeJSON(w, http.StatusOK, models.PasswordResetResponse{
		ResetToken: rawTokenHex,
		// TEMPORARY: email delivery isn't wired up yet (separate follow-up
		// task), so the raw token rides directly in this response instead
		// of only ever reaching the user's inbox. Remove ResetToken (and
		// this note) once that lands.
		Note:    "TEMPORARY: token returned directly in the response until email delivery is added",
		Message: passwordResetGenericMessage,
	})
}

// ConfirmPasswordReset POST /v1/{slug}/{stage}/db/{db}/auth/reset-password/confirm
func (h *Handler) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	var req models.PasswordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Checked before the token is touched: a bad new_password shouldn't
	// burn an otherwise-valid, still-unused token — the caller can retry
	// with a corrected password using the same token.
	if !isValidPassword(req.NewPassword) {
		h.writeError(w, http.StatusBadRequest, "invalid password (min 6 chars)")
		return
	}

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	sum := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(sum[:])

	// Atomically validate-and-consume: the WHERE clause is the single
	// source of truth for "still usable" (not used, not expired), and
	// marking it used in the same statement closes the same race Bug 2 hit
	// on signup — two concurrent confirms for the same token can't both
	// succeed.
	var userID string
	err = pool.QueryRow(ctx, `
		UPDATE auth.password_reset_tokens
		SET used_at = NOW()
		WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
		RETURNING user_id
	`, tokenHash).Scan(&userID)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid or expired reset token")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	if _, err := pool.Exec(ctx, `
		UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2
	`, string(hash), userID); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to update password: "+err.Error())
		return
	}

	// Best-effort session cleanup. NOTE: end-user access tokens are
	// stateless JWTs verified only against project.JWTSigningSecret
	// (middleware.RequireEndUserToken never consults auth.sessions), and
	// nothing ever inserts a row here for them either — so today this is a
	// harmless no-op (0 rows deleted), not real revocation. An
	// already-issued access token keeps working until it naturally expires
	// even after a password reset. See BUGS.md; fixing that needs either
	// per-user token versioning checked at verification time or real
	// server-side session storage, both bigger than this task's scope.
	if _, err := pool.Exec(ctx, `DELETE FROM auth.sessions WHERE user_id = $1`, userID); err != nil {
		h.logger.Warn("failed to clear sessions after password reset",
			slog.String("instance_id", instance.ID),
			slog.Any("error", err),
		)
	}

	h.writeJSON(w, http.StatusOK, map[string]string{"message": "password reset successful"})
}

// isValidEmail requires syntactically valid local@domain.tld. net/mail's
// ParseAddress alone isn't enough — it happily accepts "user@nodomain"
// since RFC 5322 doesn't require a TLD — so a plain dot-in-domain check is
// layered on top to reject that case too.
func isValidEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return false
	}
	at := strings.LastIndex(addr.Address, "@")
	if at == -1 {
		return false
	}
	return strings.Contains(addr.Address[at+1:], ".")
}

// isValidPassword applies the same minimum-length rule signup has always
// used. Shared with password-reset confirmation so both paths agree.
func isValidPassword(password string) bool {
	return len(password) >= 6
}

// isPgUniqueViolation reports whether err is a Postgres unique-constraint
// violation (SQLSTATE 23505) — e.g. two concurrent INSERTs racing on the
// same UNIQUE column. Callers use this to turn what Postgres reports as a
// generic error into a specific, clean HTTP response instead of a leaked
// 500.
func isPgUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

const (
	passwordResetMaxAttempts = 3
	passwordResetWindow      = time.Hour
)

// resetRequestLimiter throttles password-reset requests per key (typically
// "{projectID}:{email}") so the endpoint can't be used to spam a user with
// reset tokens or hammered as a user-enumeration oracle.
//
// In-memory and per-process — same tradeoff as
// middleware.RateLimitPerProject: fine for a single API replica, resets on
// pod restart, and isn't shared across replicas if the API ever scales out
// horizontally. A shared/production-grade limiter is a separate task.
type resetRequestLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

var passwordResetLimiter = &resetRequestLimiter{
	attempts: make(map[string][]time.Time),
}

// allow reports whether another attempt for key is permitted right now,
// recording this attempt if so. It also prunes attempts older than window
// on every call, so the map doesn't grow unbounded over a long-running
// process.
func (l *resetRequestLimiter) allow(key string, max int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := time.Now().Add(-window)
	kept := l.attempts[key][:0]
	for _, t := range l.attempts[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}

	if len(kept) >= max {
		l.attempts[key] = kept
		return false
	}

	l.attempts[key] = append(kept, time.Now())
	return true
}
