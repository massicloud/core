package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

// GET /postgres/{id}/schema/tables/{table}/indexes
func (h *Handler) GetIndexes(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	query := `
		SELECT
			indexname,
			indexdef,
			ix.indisunique,
			ix.indisprimary,
			pg_relation_size(indexrelid) as size_bytes
		FROM pg_indexes
		LEFT JOIN pg_class c ON c.relname = indexname
		LEFT JOIN pg_index ix ON ix.indexrelid = c.oid
		WHERE tablename = $1
		  AND schemaname = $2
		ORDER BY indexname
	`

	rows, err := db.QueryContext(ctx, query, table, schema)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch indexes")
		return
	}
	defer rows.Close()

	var indexes []Index
	for rows.Next() {
		var name, indexdef string
		var unique, primary bool
		var sizeBytes int64

		if err := rows.Scan(&name, &indexdef, &unique, &primary, &sizeBytes); err != nil {
			continue
		}

		// Parse index type from indexdef
		indexType := "btree"
		if indexdef != "" {
			if contains(indexdef, "USING hash") {
				indexType = "hash"
			} else if contains(indexdef, "USING gin") {
				indexType = "gin"
			} else if contains(indexdef, "USING gist") {
				indexType = "gist"
			} else if contains(indexdef, "USING brin") {
				indexType = "brin"
			}
		}

		indexes = append(indexes, Index{
			Name:      name,
			Type:      indexType,
			Columns:   []string{}, // Simplified for now
			Unique:    unique,
			Primary:   primary,
			SizeBytes: sizeBytes,
		})
	}

	if indexes == nil {
		indexes = []Index{}
	}

	h.writeJSON(w, http.StatusOK, indexes)
}

// POST /postgres/{id}/schema/tables/{table}/indexes
func (h *Handler) CreateIndex(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	var req CreateIndexRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	cols := ""
	for i, c := range req.Columns {
		if i > 0 {
			cols += ", "
		}
		cols += pq.QuoteIdentifier(c)
	}

	sql := fmt.Sprintf("CREATE INDEX %s ON %s (%s)", pq.QuoteIdentifier(req.Name), pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table), cols)
	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// DELETE /postgres/{id}/schema/tables/{table}/indexes/{index}
func (h *Handler) DeleteIndex(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	indexName := chi.URLParam(r, "index")

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	sql := fmt.Sprintf("DROP INDEX %s", pq.QuoteIdentifier(indexName))
	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

