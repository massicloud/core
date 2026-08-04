package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
	if !strings.Contains(req.Email, "@") || len(req.Password) < 6 {
		h.writeError(w, http.StatusBadRequest, "invalid email or password (min 6 chars)")
		return
	}

	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "database connection failed")
		return
	}

	var existing string
	err = pool.QueryRow(ctx, `SELECT id FROM auth.users WHERE email = $1`, req.Email).Scan(&existing)
	if err == nil {
		h.writeError(w, http.StatusConflict, "user with this email already exists")
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		h.writeError(w, http.StatusInternalServerError,
			"database error (is the auth schema initialized?)")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	userID := uuid.New().String()
	now := time.Now()

	_, err = pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, encrypted_password, created_at)
		VALUES ($1, $2, $3, $4)
	`, userID, req.Email, string(hash), now)
	if err != nil {
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
