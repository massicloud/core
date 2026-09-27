package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// POST /postgres/{id}/query
func (h *Handler) RunQuery(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")

	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SQL == "" {
		h.writeError(w, http.StatusBadRequest, "sql is required")
		return
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	start := time.Now()
	rows, err := db.QueryContext(ctx, req.SQL)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		h.writeJSON(w, http.StatusOK, QueryResponse{
			Error:         err.Error(),
			ExecutionTime: elapsed,
		})
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		h.writeJSON(w, http.StatusOK, QueryResponse{
			Error:         err.Error(),
			ExecutionTime: elapsed,
		})
		return
	}

	var result [][]interface{}
	for rows.Next() {
		raw := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range columns {
			ptrs[i] = &raw[i]
		}

		if err := rows.Scan(ptrs...); err != nil {
			continue
		}

		row := make([]interface{}, len(columns))
		for i, v := range raw {
			// lib/pq may scan text columns as []byte; JSON would base64-encode
			// those, so convert to string before marshaling.
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		result = append(result, row)
	}

	if result == nil {
		result = [][]interface{}{}
	}

	// The submitted SQL may have been DDL (CREATE TABLE, ALTER TABLE, etc.);
	// there's no cheap way to tell from here, so always nudge PostgREST to
	// reload its schema cache rather than parsing the statement.
	h.reloadPostgRESTSchema(ctx, db, id)

	h.writeJSON(w, http.StatusOK, QueryResponse{
		Columns:       columns,
		Rows:          result,
		RowCount:      len(result),
		ExecutionTime: elapsed,
	})
}
