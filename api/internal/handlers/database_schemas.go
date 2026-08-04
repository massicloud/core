package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// schemaParam reads ?schema= with a "public" default.
func schemaParam(r *http.Request) string {
	s := r.URL.Query().Get("schema")
	if s == "" {
		return "public"
	}
	return s
}

// GET /postgres/{id}/schemas
func (h *Handler) GetSchemas(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	query := `
		SELECT schema_name
		FROM information_schema.schemata
		WHERE schema_name NOT LIKE 'pg_%'
		  AND schema_name <> 'information_schema'
		ORDER BY schema_name
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch schemas")
		return
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		schemas = append(schemas, name)
	}
	if schemas == nil {
		schemas = []string{}
	}
	h.writeJSON(w, http.StatusOK, schemas)
}
