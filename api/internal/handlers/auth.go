package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.authService.Register(ctx, req)
	if err != nil {
		h.logger.Error("registration failed", slog.Any("error", err))
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.authService.Login(ctx, req)
	if err != nil {
		h.logger.Error("login failed",
			slog.String("email", req.Email),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	h.writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.store.GetUserByID(ctx, claims.UserID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "user not found")
		return
	}

	user.Password = ""
	h.writeJSON(w, http.StatusOK, user)
}
