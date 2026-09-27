package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

// GET /postgres/{id}/schema/tables
func (h *Handler) GetTables(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	schema := schemaParam(r)

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	query := `
		SELECT
			tablename,
			obj_description((schemaname||'.'||tablename)::regclass, 'pg_class') as comment
		FROM pg_tables
		WHERE schemaname = $1
		ORDER BY tablename
	`

	rows, err := db.QueryContext(ctx, query, schema)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch tables")
		return
	}
	defer rows.Close()

	var tables []Table
	for rows.Next() {
		var name, comment sql.NullString
		if err := rows.Scan(&name, &comment); err != nil {
			continue
		}

		// Get row count and size
		var rowCount int64
		var sizeBytes int64
		qualifiedName := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(name.String)
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", qualifiedName)
		db.QueryRowContext(ctx, countQuery).Scan(&rowCount)

		sizeQuery := fmt.Sprintf("SELECT pg_total_relation_size('%s.%s')", schema, name.String)
		db.QueryRowContext(ctx, sizeQuery).Scan(&sizeBytes)

		tables = append(tables, Table{
			Name:      name.String,
			RowCount:  rowCount,
			SizeBytes: sizeBytes,
			Comment:   comment.String,
		})
	}

	if tables == nil {
		tables = []Table{}
	}

	h.writeJSON(w, http.StatusOK, tables)
}

// POST /postgres/{id}/schema/tables
func (h *Handler) CreateTable(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	schema := schemaParam(r)

	var req CreateTableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		h.writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	// Build CREATE TABLE statement
	parts := make([]string, 0, len(req.Columns)+len(req.ForeignKeys))
	for _, col := range req.Columns {
		def := col.Name + " " + col.Type
		if col.Length != nil && (col.Type == "varchar" || col.Type == "char") {
			def += fmt.Sprintf("(%d)", *col.Length)
		}
		if col.IsPrimaryKey {
			def += " PRIMARY KEY"
		}
		if !col.Nullable {
			def += " NOT NULL"
		}
		if col.Default != nil {
			def += " DEFAULT " + *col.Default
		}
		parts = append(parts, def)
	}

	for _, fk := range req.ForeignKeys {
		constraintName := fmt.Sprintf("fk_%s_%s", req.Name, fk.Column)
		fkDef := fmt.Sprintf(
			"CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s(%s) ON DELETE %s ON UPDATE %s",
			pq.QuoteIdentifier(constraintName),
			pq.QuoteIdentifier(fk.Column),
			pq.QuoteIdentifier(fk.ReferencedTable),
			pq.QuoteIdentifier(fk.ReferencedColumn),
			sanitizeFKAction(fk.OnDelete),
			sanitizeFKAction(fk.OnUpdate),
		)
		parts = append(parts, fkDef)
	}

	colDefs := ""
	for i, p := range parts {
		if i > 0 {
			colDefs += ", "
		}
		colDefs += p
	}

	qualifiedName := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(req.Name)
	sql := fmt.Sprintf("CREATE TABLE %s (%s)", qualifiedName, colDefs)

	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if req.Comment != "" {
		commentSQL := fmt.Sprintf("COMMENT ON TABLE %s IS $1", qualifiedName)
		db.ExecContext(ctx, commentSQL, req.Comment)
	}

	// Enable Row Level Security on all tables created via the platform.
	// Only applies to the public schema — system schemas manage their own RLS.
	if schema == "public" {
		rlsSQL := fmt.Sprintf("ALTER TABLE %s ENABLE ROW LEVEL SECURITY", qualifiedName)
		if _, err := db.ExecContext(ctx, rlsSQL); err != nil {
			h.logger.Warn("failed to enable RLS on new table",
				slog.String("table", req.Name), slog.Any("error", err))
		}

		// Check for a user_id column that references auth.users
		hasUserIDFK := false
		for _, col := range req.Columns {
			if col.Name == "user_id" {
				for _, fk := range req.ForeignKeys {
					if fk.Column == "user_id" && fk.ReferencedTable == "auth.users" {
						hasUserIDFK = true
						break
					}
				}
			}
		}

		var defaultPolicy string
		if hasUserIDFK {
			defaultPolicy = fmt.Sprintf(`
				CREATE POLICY "Users see own rows" ON %s
				FOR ALL TO authenticated
				USING (user_id = auth.uid())
				WITH CHECK (user_id = auth.uid())`, qualifiedName)
		} else {
			defaultPolicy = fmt.Sprintf(`
				CREATE POLICY "Authenticated read all" ON %s
				FOR SELECT TO authenticated
				USING (true)`, qualifiedName)
		}
		db.ExecContext(ctx, defaultPolicy) //nolint:errcheck

		servicePolicy := fmt.Sprintf(`
			CREATE POLICY "Service role full access" ON %s
			FOR ALL TO service_role
			USING (true) WITH CHECK (true)`, qualifiedName)
		db.ExecContext(ctx, servicePolicy) //nolint:errcheck
	}

	h.reloadPostgRESTSchema(ctx, db, id)
	w.WriteHeader(http.StatusCreated)
}

// DELETE /postgres/{id}/schema/tables/{table}
func (h *Handler) DeleteTable(w http.ResponseWriter, r *http.Request) {
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

	sql := fmt.Sprintf("DROP TABLE %s", pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table))
	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.reloadPostgRESTSchema(ctx, db, id)
	w.WriteHeader(http.StatusNoContent)
}

// POST /postgres/{id}/schema/tables/{table}/truncate
func (h *Handler) TruncateTable(w http.ResponseWriter, r *http.Request) {
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

	sql := fmt.Sprintf("TRUNCATE %s CASCADE", pq.QuoteIdentifier(schema)+"."+pq.QuoteIdentifier(table))
	if _, err := db.ExecContext(ctx, sql); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// POST /postgres/{id}/schema/tables/{table}/rls
func (h *Handler) EnableRLS(w http.ResponseWriter, r *http.Request) {
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

	qualifiedName := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(table)
	if _, err := db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE %s ENABLE ROW LEVEL SECURITY", qualifiedName)); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reloadPostgRESTSchema(ctx, db, id)
	w.WriteHeader(http.StatusNoContent)
}

// sanitizeFKAction whitelists FK referential action keywords to prevent injection.
func sanitizeFKAction(action string) string {
	switch action {
	case "CASCADE", "RESTRICT", "SET NULL", "SET DEFAULT", "NO ACTION":
		return action
	default:
		return "NO ACTION"
	}
}

// GET /postgres/{id}/schema/tables-with-columns?schema=public
// Returns all tables in the schema along with their columns — used by the FK picker.
func (h *Handler) GetTablesWithColumns(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	id := chi.URLParam(r, "id")
	schema := r.URL.Query().Get("schema")
	if schema == "" {
		schema = "public"
	}

	db, err := h.getPostgresConnection(ctx, id)
	if err != nil {
		h.writePostgresConnectionError(w, err)
		return
	}
	defer db.Close()

	query := `
		SELECT
			c.relname                                              AS table_name,
			a.attname                                              AS col_name,
			t.typname                                              AS col_type,
			COALESCE(ix.indisprimary, false)                       AS is_pk
		FROM   pg_class       c
		JOIN   pg_namespace   n  ON n.oid = c.relnamespace
		JOIN   pg_attribute   a  ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
		JOIN   pg_type        t  ON t.oid = a.atttypid
		LEFT JOIN pg_index    ix ON ix.indrelid = c.oid
		                        AND a.attnum = ANY(ix.indkey)
		                        AND ix.indisprimary
		WHERE  n.nspname = $1
		  AND  c.relkind  = 'r'
		ORDER BY c.relname, a.attnum
	`

	rows, err := db.QueryContext(ctx, query, schema)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch tables")
		return
	}
	defer rows.Close()

	tableMap := make(map[string]*TableWithColumns)
	var order []string

	for rows.Next() {
		var tableName, colName, colType string
		var isPK bool
		if err := rows.Scan(&tableName, &colName, &colType, &isPK); err != nil {
			continue
		}
		if _, ok := tableMap[tableName]; !ok {
			tableMap[tableName] = &TableWithColumns{
				Schema:  schema,
				Name:    tableName,
				Columns: []TableColumn{},
			}
			order = append(order, tableName)
		}
		tableMap[tableName].Columns = append(tableMap[tableName].Columns, TableColumn{
			Name:         colName,
			Type:         colType,
			IsPrimaryKey: isPK,
		})
	}

	result := make([]TableWithColumns, 0, len(order))
	for _, name := range order {
		result = append(result, *tableMap[name])
	}

	h.writeJSON(w, http.StatusOK, result)
}

