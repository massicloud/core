package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mikaminou/massicloud/api/internal/initschemas"
)

type initializeRequest struct {
	Schemas []initschemas.SchemaKind `json:"schemas"`
}

type initializeResponse struct {
	Status     string                   `json:"status"`
	Extensions []string                 `json:"extensions"`
	Schemas    []initschemas.SchemaKind `json:"schemas"`
}

// InitializePostgres handles POST /postgres/{id}/initialize
func (h *Handler) InitializePostgres(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")

	var req initializeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	for _, k := range req.Schemas {
		if !k.Valid() {
			h.writeError(w, http.StatusBadRequest,
				"invalid schema: must be auth, audit, or compliance")
			return
		}
	}

	if err := h.initService.Initialize(ctx, instanceID, req.Schemas); err != nil {
		h.logger.Error("initialize failed",
			slog.String("instance_id", instanceID),
			slog.Any("error", err),
		)
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, initializeResponse{
		Status:     "initialized",
		Extensions: []string{"uuid-ossp", "pgcrypto", "pg_stat_statements"},
		Schemas:    req.Schemas,
	})
}
