package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

// pkColumnForTable returns the primary-key column name for the given schema-qualified table.
func pkColumnForTable(ctx context.Context, db *sql.DB, schema, table string) (string, error) {
	const q = `
		SELECT a.attname
		FROM   pg_attribute a
		JOIN   pg_index    ix ON  ix.indrelid = a.attrelid
		                      AND a.attnum = ANY(ix.indkey)
		WHERE  a.attrelid = $1::regclass
		AND    ix.indisprimary
		AND    a.attnum > 0
		LIMIT  1`
	var col string
	err := db.QueryRowContext(ctx, q, schema+"."+table).Scan(&col)
	return col, err
}

// GET /postgres/{id}/tables/{table}/rows
func (h *Handler) GetRows(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	qualifiedTable := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(table)

	// Get total count
	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", qualifiedTable)
	if err := db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to count rows")
		return
	}

	// Fetch rows
	query := fmt.Sprintf("SELECT * FROM %s LIMIT $1 OFFSET $2", qualifiedTable)
	rows, err := db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch rows")
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to get columns")
		return
	}

	var result []map[string]interface{}
	for rows.Next() {
		entry, err := scanRow(rows, columns)
		if err != nil {
			continue
		}
		result = append(result, entry)
	}

	if result == nil {
		result = []map[string]interface{}{}
	}

	h.writeJSON(w, http.StatusOK, RowsResult{
		Rows:  result,
		Total: total,
	})
}

// POST /postgres/{id}/tables/{table}/rows
func (h *Handler) InsertRow(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	// Decode flat JSON object {col: value, ...} directly — no wrapper key.
	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	slog.Info("insert: decoded body", "table", table, "data", data)

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	qualifiedTable := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(table)

	// Build INSERT statement
	var insertSQL string
	var vals []interface{}

	if len(data) == 0 {
		// No explicit values — let PostgreSQL use column defaults for everything.
		insertSQL = fmt.Sprintf("INSERT INTO %s DEFAULT VALUES", qualifiedTable)
	} else {
		cols := make([]string, 0, len(data))
		vals = make([]interface{}, 0, len(data))
		placeholders := ""

		i := 1
		for k, v := range data {
			cols = append(cols, pq.QuoteIdentifier(k))
			vals = append(vals, v)
			if i > 1 {
				placeholders += ", "
			}
			placeholders += fmt.Sprintf("$%d", i)
			i++
		}

		colStr := ""
		for j, c := range cols {
			if j > 0 {
				colStr += ", "
			}
			colStr += c
		}

		slog.Info("insert: prepared query",
			"table", table,
			"cols", cols,
			"placeholders", placeholders,
			"vals", vals,
		)

		insertSQL = fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", qualifiedTable, colStr, placeholders)
	}

	// RETURNING * so the caller gets the full stored row (DB-generated UUIDs,
	// defaults, etc.) and can verify / display it without a second round-trip.
	insertSQL += " RETURNING *"

	rows, err := db.QueryContext(ctx, insertSQL, vals...)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to read column names")
		return
	}

	if rows.Next() {
		entry, err := scanRow(rows, cols)
		if err != nil {
			h.writeError(w, http.StatusInternalServerError, "failed to scan inserted row")
			return
		}
		h.writeJSON(w, http.StatusCreated, entry)
		return
	}

	// Fallback (should not happen with RETURNING *)
	h.writeJSON(w, http.StatusCreated, map[string]string{"status": "inserted"})
}

// PUT /postgres/{id}/tables/{table}/rows/{pk}
func (h *Handler) UpdateRow(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	pkVal := chi.URLParam(r, "pk")
	schema := schemaParam(r)

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	db, err := h.getPostgresConnection(ctx, instanceID)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	pkCol, err := pkColumnForTable(ctx, db, schema, table)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to locate primary key")
		return
	}

	// Build SET clause — skip the PK column itself
	setClauses := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	i := 1
	for k, v := range data {
		if k == pkCol {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", pq.QuoteIdentifier(k), i))
		vals = append(vals, v)
		i++
	}

	if len(setClauses) == 0 {
		h.writeError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	vals = append(vals, pkVal)
	stmt := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = $%d",
		pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table),
		strings.Join(setClauses, ", "),
		pq.QuoteIdentifier(pkCol),
		i,
	)

	if _, err := db.ExecContext(ctx, stmt, vals...); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /postgres/{id}/tables/{table}/rows/{pk}
func (h *Handler) DeleteRow(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	pkVal := chi.URLParam(r, "pk")
	schema := schemaParam(r)

	db, err := h.getPostgresConnection(ctx, instanceID)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	pkCol, err := pkColumnForTable(ctx, db, schema, table)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to locate primary key")
		return
	}

	stmt := fmt.Sprintf("DELETE FROM %s WHERE %s = $1", pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table), pq.QuoteIdentifier(pkCol))
	if _, err := db.ExecContext(ctx, stmt, pkVal); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /postgres/{id}/tables/{table}/rows/bulk-delete
func (h *Handler) BulkDeleteRows(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	instanceID := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	var req struct {
		PKs []interface{} `json:"pks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.PKs) == 0 {
		h.writeError(w, http.StatusBadRequest, "pks array is required")
		return
	}

	db, err := h.getPostgresConnection(ctx, instanceID)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	pkCol, err := pkColumnForTable(ctx, db, schema, table)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to locate primary key")
		return
	}

	// Build WHERE pk IN ($1, $2, …) manually so it works for both text and numeric PKs
	placeholders := make([]string, len(req.PKs))
	for i := range req.PKs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	stmt := fmt.Sprintf(
		"DELETE FROM %s WHERE %s IN (%s)",
		pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table),
		pq.QuoteIdentifier(pkCol),
		strings.Join(placeholders, ", "),
	)

	args := make([]interface{}, len(req.PKs))
	copy(args, req.PKs)

	if _, err := db.ExecContext(ctx, stmt, args...); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
