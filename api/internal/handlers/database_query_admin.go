package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// AdminQuery is the counterpart to database_query.go's RunQuery: that one is
// for the portal (platform JWT, arbitrary tenant chosen via {id}), this one
// is for external tools — migration runners, admin scripts, integration
// tests — authenticated with a project's service key over the same
// /v1/{slug}/{stage}/db/{db} routes the REST proxy uses. It's what lets
// Prisma/Drizzle/Sqitch/dbmate/sqlc/plain psql scripts run DDL against a
// MassiCloud database from outside the portal.
//
// POST /v1/{slug}/{stage}/db/{db}/query
func (h *Handler) AdminQuery(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	project, _ := r.Context().Value(middleware.CtxProject).(models.Project)
	instance, _ := r.Context().Value(middleware.CtxInstance).(models.Instance)

	apiKey, _ := r.Context().Value(middleware.CtxAPIKey).(models.APIKey)
	if apiKey.Type != models.APIKeyService {
		h.writeError(w, http.StatusForbidden, "service key required for the admin query endpoint")
		return
	}

	// RequireStageInstance (which resolves {db} onto CtxInstance) already
	// 400s on a non-postgres instance, so there's nothing else to check here.

	var req struct {
		Query  string        `json:"query"`
		Params []interface{} `json:"params,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Query) == "" {
		h.writeError(w, http.StatusBadRequest, "query is required")
		return
	}

	// Reuses the same pooled connections proxy.GetPool already maintains
	// for the portal's SQL console (project_auth.go, stages.go) rather than
	// opening a fresh connection per request.
	pool, err := h.proxy.GetPool(ctx, instance.ID)
	if err != nil {
		h.writeError(w, http.StatusBadGateway, "failed to connect to the database")
		return
	}

	logQuery := func(rowCount int, took time.Duration, queryErr error) {
		attrs := []any{
			"project_id", project.ID,
			"instance_id", instance.ID,
			"query_preview", previewQuery(req.Query),
			"took_ms", took.Milliseconds(),
			"row_count", rowCount,
		}
		if queryErr != nil {
			h.logger.Warn("admin query failed", append(attrs, "error", queryErr)...)
		} else {
			h.logger.Info("admin query", attrs...)
		}
	}

	start := time.Now()

	// No params → simple protocol, so multi-statement scripts (BEGIN; ...;
	// COMMIT;) and dollar-quoted function bodies ($$ ... $$, which the
	// extended protocol's placeholder parser would otherwise trip over)
	// both work. With params, a single parameterized statement uses the
	// normal extended protocol.
	var rows pgx.Rows
	if len(req.Params) > 0 {
		rows, err = pool.Query(ctx, req.Query, req.Params...)
	} else {
		rows, err = pool.Query(ctx, req.Query, pgx.QueryExecModeSimpleProtocol)
	}
	if err != nil {
		logQuery(0, time.Since(start), err)
		h.writeSQLError(w, err)
		return
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, f := range fields {
		columns[i] = f.Name
	}

	collected := make([][]interface{}, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			logQuery(len(collected), time.Since(start), err)
			h.writeSQLError(w, err)
			return
		}
		for i, v := range values {
			// lib/pq elsewhere in this codebase hit the same issue: text
			// columns can come back as []byte, which json.Marshal would
			// base64-encode instead of rendering as a string.
			if b, ok := v.([]byte); ok {
				values[i] = string(b)
			}
		}
		collected = append(collected, values)
	}
	if err := rows.Err(); err != nil {
		logQuery(len(collected), time.Since(start), err)
		h.writeSQLError(w, err)
		return
	}

	tag := rows.CommandTag()
	took := time.Since(start)
	logQuery(len(collected), took, nil)

	// Cheap enough to always send rather than guess from the query text
	// whether it was DDL — same approach as the portal's RunQuery.
	if _, err := pool.Exec(ctx, "NOTIFY pgrst, 'reload schema'"); err != nil {
		h.logger.Warn("failed to notify postgrest of schema reload",
			"instance_id", instance.ID, "error", err)
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"columns":  columns,
		"rows":     collected,
		"rowCount": len(collected),
		"command":  commandVerb(tag.String()),
		"took_ms":  took.Milliseconds(),
	})
}

// previewQuery trims a logged query to a bounded length so a multi-megabyte
// migration script doesn't blow up log storage.
func previewQuery(q string) string {
	q = strings.TrimSpace(q)
	const max = 200
	if len(q) <= max {
		return q
	}
	return q[:max] + "…"
}

// commandVerb strips the trailing row count pgx's CommandTag.String()
// includes (e.g. "SELECT 2", "INSERT 0 1") down to the command itself,
// leaving multi-word tags like "CREATE TABLE" intact. Row count is already
// reported separately as rowCount.
func commandVerb(tag string) string {
	var verb []string
	for _, f := range strings.Fields(tag) {
		if _, err := strconv.Atoi(f); err == nil {
			break
		}
		verb = append(verb, f)
	}
	return strings.Join(verb, " ")
}

// writeSQLError renders a Postgres error as structured JSON (400) so
// callers — migration tools especially — can branch on `code` (the SQLSTATE)
// instead of parsing `error` text.
func (h *Handler) writeSQLError(w http.ResponseWriter, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		h.writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":    pgErr.Message,
			"code":     pgErr.Code,
			"detail":   nullableString(pgErr.Detail),
			"hint":     nullableString(pgErr.Hint),
			"position": nullablePosition(pgErr.Position),
		})
		return
	}

	h.writeJSON(w, http.StatusBadRequest, map[string]interface{}{
		"error":    err.Error(),
		"code":     nil,
		"detail":   nil,
		"hint":     nil,
		"position": nil,
	})
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullablePosition(p int32) *int32 {
	if p == 0 {
		return nil
	}
	return &p
}
