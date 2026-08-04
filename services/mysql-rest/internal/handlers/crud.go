package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mikaminou/massicloud/services/mysql-rest/internal/auth"
	"github.com/mikaminou/massicloud/services/mysql-rest/internal/filters"
)

var tableNameRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`)

const metaCacheTTL = time.Minute

type tableMeta struct {
	columns   map[string]bool
	pk        string
	expiresAt time.Time
}

type App struct {
	AnonDB    *sql.DB
	ServiceDB *sql.DB

	metaMu    sync.RWMutex
	metaCache map[string]tableMeta
}

func New(anonDB, serviceDB *sql.DB) *App {
	return &App{
		AnonDB:    anonDB,
		ServiceDB: serviceDB,
		metaCache: make(map[string]tableMeta),
	}
}

func (a *App) poolForRole(role string) *sql.DB {
	if role == auth.RoleService {
		return a.ServiceDB
	}
	return a.AnonDB
}

func validateTableName(table string) error {
	if !tableNameRe.MatchString(table) {
		return fmt.Errorf("invalid table name %q", table)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// tableMetadata returns the column allowlist and primary key for a table,
// cached for a minute to avoid a SHOW COLUMNS/SHOW KEYS round trip on every
// request. Table name is already validated by the caller (regexp-only —
// safe to interpolate directly, MySQL has no placeholder support for
// identifiers in SHOW statements).
func (a *App) tableMetadata(ctx context.Context, db *sql.DB, table string) (tableMeta, error) {
	a.metaMu.RLock()
	m, ok := a.metaCache[table]
	a.metaMu.RUnlock()
	if ok && time.Now().Before(m.expiresAt) {
		return m, nil
	}

	cols := make(map[string]bool)
	rows, err := db.QueryContext(ctx, "SHOW COLUMNS FROM `"+table+"`")
	if err != nil {
		return tableMeta{}, fmt.Errorf("show columns: %w", err)
	}
	for rows.Next() {
		var field, ctype, null, key, extra string
		var def sql.NullString
		if err := rows.Scan(&field, &ctype, &null, &key, &def, &extra); err != nil {
			rows.Close()
			return tableMeta{}, fmt.Errorf("scan columns: %w", err)
		}
		cols[field] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return tableMeta{}, err
	}
	rows.Close()

	if len(cols) == 0 {
		return tableMeta{}, fmt.Errorf("table %q not found", table)
	}

	pk, err := primaryKeyColumn(ctx, db, table)
	if err != nil {
		return tableMeta{}, err
	}

	meta := tableMeta{columns: cols, pk: pk, expiresAt: time.Now().Add(metaCacheTTL)}
	a.metaMu.Lock()
	a.metaCache[table] = meta
	a.metaMu.Unlock()
	return meta, nil
}

func primaryKeyColumn(ctx context.Context, db *sql.DB, table string) (string, error) {
	rows, err := db.QueryContext(ctx, "SHOW KEYS FROM `"+table+"` WHERE Key_name = 'PRIMARY'")
	if err != nil {
		return "", fmt.Errorf("show keys: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return "", err
	}

	var pk string
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return "", err
		}
		for i, c := range cols {
			if c == "Column_name" {
				pk = toStr(vals[i])
			}
		}
		break // composite primary keys: only the first column is used (v1 limitation)
	}
	return pk, rows.Err()
}

// toStr normalizes a database/sql scanned value to string, converting the
// []byte the mysql driver returns for most types.
func toStr(v any) string {
	switch t := v.(type) {
	case []byte:
		return string(t)
	case string:
		return t
	default:
		return fmt.Sprintf("%v", t)
	}
}

// rowsToMaps scans every row into a JSON-friendly map, converting []byte
// columns (the mysql driver's default for most types) to string.
func rowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	result := []map[string]any{}
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, col := range cols {
			if b, ok := vals[i].([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = vals[i]
			}
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// ListRows handles GET /rest/{table}.
func (a *App) ListRows(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	db := a.poolForRole(auth.RoleFromContext(r.Context()))
	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	pq, err := filters.Parse(r.URL.Query(), meta.columns)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	selectCols := "*"
	if len(pq.Select) > 0 {
		selectCols = "`" + strings.Join(pq.Select, "`, `") + "`"
	}

	query := fmt.Sprintf("SELECT %s FROM `%s`", selectCols, table)
	args := append([]any{}, pq.WhereArgs...)
	if pq.Where != "" {
		query += " WHERE " + pq.Where
	}
	if pq.OrderBy != "" {
		query += " ORDER BY " + pq.OrderBy
	}
	query += " LIMIT ?"
	args = append(args, pq.Limit)
	if pq.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, pq.Offset)
	}

	rows, err := db.QueryContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	result, err := rowsToMaps(rows)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "scan failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// GetRow handles GET /rest/{table}/{id}.
func (a *App) GetRow(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	id := chi.URLParam(r, "id")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	db := a.poolForRole(auth.RoleFromContext(r.Context()))
	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if meta.pk == "" {
		writeError(w, http.StatusBadRequest, "table has no primary key")
		return
	}

	rows, err := db.QueryContext(r.Context(),
		fmt.Sprintf("SELECT * FROM `%s` WHERE `%s` = ?", table, meta.pk), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query failed: "+err.Error())
		return
	}
	defer rows.Close()

	result, err := rowsToMaps(rows)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "scan failed: "+err.Error())
		return
	}
	if len(result) == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, result[0])
}

// CountRows handles GET /rest/{table}/count.
func (a *App) CountRows(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	db := a.poolForRole(auth.RoleFromContext(r.Context()))
	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	pq, err := filters.Parse(r.URL.Query(), meta.columns)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", table)
	if pq.Where != "" {
		query += " WHERE " + pq.Where
	}

	var count int64
	if err := db.QueryRowContext(r.Context(), query, pq.WhereArgs...).Scan(&count); err != nil {
		writeError(w, http.StatusInternalServerError, "count failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"count": count})
}

// InsertRows handles POST /rest/{table} — service role only.
func (a *App) InsertRows(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if auth.RoleFromContext(r.Context()) != auth.RoleService {
		writeError(w, http.StatusForbidden, "anon role cannot write")
		return
	}
	db := a.ServiceDB

	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	var objects []map[string]any
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		if err := json.Unmarshal(trimmed, &objects); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON array: "+err.Error())
			return
		}
	} else {
		var obj map[string]any
		if err := json.Unmarshal(trimmed, &obj); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON object: "+err.Error())
			return
		}
		objects = []map[string]any{obj}
	}
	if len(objects) == 0 {
		writeError(w, http.StatusBadRequest, "no rows to insert")
		return
	}

	var columns []string
	for k := range objects[0] {
		if !meta.columns[k] {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("unknown column %q", k))
			return
		}
		columns = append(columns, k)
	}
	sort.Strings(columns)

	quotedCols := make([]string, len(columns))
	for i, c := range columns {
		quotedCols[i] = "`" + c + "`"
	}
	placeholderRow := "(" + strings.TrimSuffix(strings.Repeat("?,", len(columns)), ",") + ")"

	var placeholders []string
	var args []any
	for _, obj := range objects {
		if len(obj) != len(columns) {
			writeError(w, http.StatusBadRequest, "all rows in a batch insert must have the same columns")
			return
		}
		for _, col := range columns {
			v, ok := obj[col]
			if !ok {
				writeError(w, http.StatusBadRequest, "all rows in a batch insert must have the same columns")
				return
			}
			args = append(args, v)
		}
		placeholders = append(placeholders, placeholderRow)
	}

	query := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES %s",
		table, strings.Join(quotedCols, ", "), strings.Join(placeholders, ", "))

	result, err := db.ExecContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "insert failed: "+err.Error())
		return
	}

	inserted, err := fetchInsertedRows(r.Context(), db, table, meta, result, len(objects))
	if err != nil {
		// Insert succeeded even if the read-back failed — echo what was sent.
		writeJSON(w, http.StatusCreated, objects)
		return
	}
	writeJSON(w, http.StatusCreated, inserted)
}

// fetchInsertedRows reads back rows just inserted, using MySQL's guarantee
// that LAST_INSERT_ID() returns the first auto-generated id of a multi-row
// INSERT (subsequent ids are sequential from there). If the table has no
// primary key or the id isn't auto-increment, returns an error so the
// caller falls back to echoing the sent payload.
func fetchInsertedRows(ctx context.Context, db *sql.DB, table string, meta tableMeta, result sql.Result, n int) ([]map[string]any, error) {
	if meta.pk == "" {
		return nil, fmt.Errorf("no primary key")
	}
	firstID, err := result.LastInsertId()
	if err != nil || firstID == 0 {
		return nil, fmt.Errorf("not auto-increment")
	}

	ids := make([]any, n)
	placeholders := make([]string, n)
	for i := 0; i < n; i++ {
		ids[i] = firstID + int64(i)
		placeholders[i] = "?"
	}

	rows, err := db.QueryContext(ctx,
		fmt.Sprintf("SELECT * FROM `%s` WHERE `%s` IN (%s)", table, meta.pk, strings.Join(placeholders, ", ")),
		ids...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsToMaps(rows)
}

// UpdateRow handles PATCH /rest/{table}/{id} — service role only.
func (a *App) UpdateRow(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	id := chi.URLParam(r, "id")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if auth.RoleFromContext(r.Context()) != auth.RoleService {
		writeError(w, http.StatusForbidden, "anon role cannot write")
		return
	}
	db := a.ServiceDB

	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if meta.pk == "" {
		writeError(w, http.StatusBadRequest, "table has no primary key")
		return
	}

	var obj map[string]any
	if err := json.NewDecoder(r.Body).Decode(&obj); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON object")
		return
	}
	if len(obj) == 0 {
		writeError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	var columns []string
	for k := range obj {
		columns = append(columns, k)
	}
	sort.Strings(columns)

	var setClauses []string
	var args []any
	for _, k := range columns {
		if !meta.columns[k] {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("unknown column %q", k))
			return
		}
		setClauses = append(setClauses, "`"+k+"` = ?")
		args = append(args, obj[k])
	}
	args = append(args, id)

	query := fmt.Sprintf("UPDATE `%s` SET %s WHERE `%s` = ?", table, strings.Join(setClauses, ", "), meta.pk)
	result, err := db.ExecContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update failed: "+err.Error())
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	rows, err := db.QueryContext(r.Context(),
		fmt.Sprintf("SELECT * FROM `%s` WHERE `%s` = ?", table, meta.pk), id)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
		return
	}
	defer rows.Close()
	updated, err := rowsToMaps(rows)
	if err != nil || len(updated) == 0 {
		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
		return
	}
	writeJSON(w, http.StatusOK, updated[0])
}

// DeleteRow handles DELETE /rest/{table}/{id} — service role only.
func (a *App) DeleteRow(w http.ResponseWriter, r *http.Request) {
	table := chi.URLParam(r, "table")
	id := chi.URLParam(r, "id")
	if err := validateTableName(table); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if auth.RoleFromContext(r.Context()) != auth.RoleService {
		writeError(w, http.StatusForbidden, "anon role cannot write")
		return
	}
	db := a.ServiceDB

	meta, err := a.tableMetadata(r.Context(), db, table)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if meta.pk == "" {
		writeError(w, http.StatusBadRequest, "table has no primary key")
		return
	}

	result, err := db.ExecContext(r.Context(), fmt.Sprintf("DELETE FROM `%s` WHERE `%s` = ?", table, meta.pk), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed: "+err.Error())
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
