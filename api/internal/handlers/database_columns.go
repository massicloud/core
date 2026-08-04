package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

// GET /postgres/{id}/schema/tables/{table}/columns
func (h *Handler) GetColumns(w http.ResponseWriter, r *http.Request) {
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
			a.attname,
			t.typname,
			a.atttypmod,
			NOT a.attnotnull as nullable,
			pg_get_expr(d.adbin, d.adrelid) as default_val,
			ix.indisprimary as is_primary,
			a.attnotnull and not ix.indisprimary as is_unique
		FROM pg_attribute a
		JOIN pg_type t ON a.atttypid = t.oid
		LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
		LEFT JOIN pg_index ix ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
		WHERE a.attrelid = $1::regclass AND a.attnum > 0
		ORDER BY a.attnum
	`

	rows, err := db.QueryContext(ctx, query, schema+"."+table)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch columns")
		return
	}
	defer rows.Close()

	var columns []Column
	for rows.Next() {
		var name, typName string
		var typMod int32
		var nullable bool
		var defaultVal sql.NullString
		var isPrimary sql.NullBool
		var isUnique sql.NullBool

		if err := rows.Scan(&name, &typName, &typMod, &nullable, &defaultVal, &isPrimary, &isUnique); err != nil {
			continue
		}

		col := Column{
			Name:         name,
			Type:         typName,
			Nullable:     nullable,
			IsPrimaryKey: isPrimary.Bool,
			IsUnique:     isUnique.Bool,
		}

		if defaultVal.Valid {
			col.Default = &defaultVal.String
		}

		// Determine length for varchar/char types
		if (typName == "varchar" || typName == "char") && typMod > 0 {
			length := int(typMod - 4)
			col.Length = &length
		}

		columns = append(columns, col)
	}

	if columns == nil {
		columns = []Column{}
	}

	h.writeJSON(w, http.StatusOK, columns)
}

// POST /postgres/{id}/schema/tables/{table}/columns
func (h *Handler) AddColumn(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	var col ColumnDefinition
	if err := json.NewDecoder(r.Body).Decode(&col); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table), col.Name, col.Type)
	if !col.Nullable {
		sql += " NOT NULL"
	}
	if col.Default != nil {
		sql += " DEFAULT " + *col.Default
	}

	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// PATCH /postgres/{id}/schema/tables/{table}/columns/{column}
func (h *Handler) AlterColumn(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	column := chi.URLParam(r, "column")
	schema := schemaParam(r)

	var req struct {
		DefaultValue *string `json:"default_value"` // nil = don't touch; "" = DROP DEFAULT; otherwise SET DEFAULT
		Nullable     *bool   `json:"nullable"`      // nil = don't touch
	}
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

	tbl := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(table)
	col := pq.QuoteIdentifier(column)

	if req.DefaultValue != nil {
		var stmt string
		if *req.DefaultValue == "" {
			stmt = fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP DEFAULT", tbl, col)
		} else {
			stmt = fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s SET DEFAULT %s", tbl, col, *req.DefaultValue)
		}
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			h.writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if req.Nullable != nil {
		var stmt string
		if *req.Nullable {
			stmt = fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP NOT NULL", tbl, col)
		} else {
			stmt = fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s SET NOT NULL", tbl, col)
		}
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			h.writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// DELETE /postgres/{id}/schema/tables/{table}/columns/{column}
func (h *Handler) DeleteColumn(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	column := chi.URLParam(r, "column")
	schema := schemaParam(r)

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	sql := fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table), pq.QuoteIdentifier(column))
	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

