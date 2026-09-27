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

// GET /postgres/{id}/schema/tables/{table}/foreign-keys
func (h *Handler) GetForeignKeys(w http.ResponseWriter, r *http.Request) {
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

	// Use pg_constraint directly — information_schema.referential_constraints
	// uses column names that don't exist in PostgreSQL's own catalog views.
	query := `
		SELECT
			con.conname                                        AS constraint_name,
			a.attname                                          AS column_name,
			frel.relname                                       AS referenced_table,
			fa.attname                                         AS referenced_column,
			CASE con.confupdtype
				WHEN 'a' THEN 'NO ACTION'
				WHEN 'r' THEN 'RESTRICT'
				WHEN 'c' THEN 'CASCADE'
				WHEN 'n' THEN 'SET NULL'
				WHEN 'd' THEN 'SET DEFAULT'
			END                                                AS update_rule,
			CASE con.confdeltype
				WHEN 'a' THEN 'NO ACTION'
				WHEN 'r' THEN 'RESTRICT'
				WHEN 'c' THEN 'CASCADE'
				WHEN 'n' THEN 'SET NULL'
				WHEN 'd' THEN 'SET DEFAULT'
			END                                                AS delete_rule
		FROM   pg_constraint  con
		JOIN   pg_class        rel  ON  rel.oid  = con.conrelid
		JOIN   pg_namespace    n    ON  n.oid    = rel.relnamespace
		JOIN   pg_class        frel ON  frel.oid = con.confrelid
		JOIN   pg_attribute    a    ON  a.attrelid = con.conrelid
		                            AND a.attnum   = ANY(con.conkey)
		JOIN   pg_attribute    fa   ON  fa.attrelid = con.confrelid
		                            AND fa.attnum   = ANY(con.confkey)
		WHERE  con.contype = 'f'
		  AND  rel.relname = $1
		  AND  n.nspname   = $2
		ORDER  BY con.conname
	`

	rows, err := db.QueryContext(ctx, query, table, schema)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch foreign keys: "+err.Error())
		return
	}
	defer rows.Close()

	var fks []ForeignKey
	for rows.Next() {
		var name, column, refTable, refColumn, updateRule, deleteRule string
		if err := rows.Scan(&name, &column, &refTable, &refColumn, &updateRule, &deleteRule); err != nil {
			continue
		}
		fks = append(fks, ForeignKey{
			Name:             name,
			Column:           column,
			ReferencedTable:  refTable,
			ReferencedColumn: refColumn,
			OnUpdate:         updateRule,
			OnDelete:         deleteRule,
		})
	}

	if fks == nil {
		fks = []ForeignKey{}
	}

	h.writeJSON(w, http.StatusOK, fks)
}

// POST /postgres/{id}/schema/tables/{table}/foreign-keys
func (h *Handler) AddForeignKey(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id    := chi.URLParam(r, "id")
	table := chi.URLParam(r, "table")
	schema := schemaParam(r)

	var req ForeignKeyDefinition
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Column == "" || req.ReferencedTable == "" || req.ReferencedColumn == "" {
		h.writeError(w, http.StatusBadRequest, "column, referenced_table and referenced_column are required")
		return
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	constraintName := fmt.Sprintf("fk_%s_%s", table, req.Column)
	stmt := fmt.Sprintf(
		"ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s(%s) ON DELETE %s ON UPDATE %s",
		pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table),
		pq.QuoteIdentifier(constraintName),
		pq.QuoteIdentifier(req.Column),
		pq.QuoteIdentifier(req.ReferencedTable),
		pq.QuoteIdentifier(req.ReferencedColumn),
		sanitizeFKAction(req.OnDelete),
		sanitizeFKAction(req.OnUpdate),
	)

	if _, err := db.ExecContext(ctx, stmt); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reloadPostgRESTSchema(ctx, db, id)
	w.WriteHeader(http.StatusCreated)
}

// DELETE /postgres/{id}/schema/tables/{table}/foreign-keys/{fk}
func (h *Handler) DeleteForeignKey(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id         := chi.URLParam(r, "id")
	table      := chi.URLParam(r, "table")
	constraint := chi.URLParam(r, "fk")
	schema     := schemaParam(r)

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	stmt := fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT %s",
		pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table),
		pq.QuoteIdentifier(constraint),
	)
	if _, err := db.ExecContext(ctx, stmt); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reloadPostgRESTSchema(ctx, db, id)
	w.WriteHeader(http.StatusNoContent)
}
