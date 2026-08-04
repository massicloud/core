// Package filters parses PostgREST-compatible query-string filters into
// parameterized SQL fragments. Every value the caller supplies ends up as a
// placeholder argument — column/table identifiers are the only thing ever
// interpolated into the query string, and only after an allowlist check.
package filters

import (
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

const defaultLimit = 100

var specialParams = map[string]bool{
	"select": true,
	"order":  true,
	"limit":  true,
	"offset": true,
}

var validOps = map[string]bool{
	"eq": true, "neq": true, "gt": true, "gte": true,
	"lt": true, "lte": true, "like": true, "in": true, "is": true,
}

// ParsedQuery is a safe, parameterized description of a filtered query.
type ParsedQuery struct {
	Select    []string // validated column names, empty means "*"
	Where     string   // "`col1` = ? AND `col2` IN (?, ?)"
	WhereArgs []any
	OrderBy   string // "`col1` DESC, `col2` ASC"
	Limit     int
	Offset    int
}

// Parse converts URL query params into a ParsedQuery. allowlist must contain
// every valid column name for the table (typically from SHOW COLUMNS) —
// any column not in it is rejected rather than interpolated.
func Parse(values url.Values, allowlist map[string]bool) (*ParsedQuery, error) {
	pq := &ParsedQuery{Limit: defaultLimit}

	if sel := values.Get("select"); sel != "" {
		for _, c := range strings.Split(sel, ",") {
			c = strings.TrimSpace(c)
			if !allowlist[c] {
				return nil, fmt.Errorf("unknown column in select: %q", c)
			}
			pq.Select = append(pq.Select, c)
		}
	}

	if ord := values.Get("order"); ord != "" {
		var clauses []string
		for _, p := range strings.Split(ord, ",") {
			p = strings.TrimSpace(p)
			col, dir := p, "ASC"
			if idx := strings.LastIndex(p, "."); idx != -1 {
				switch strings.ToLower(p[idx+1:]) {
				case "asc":
					col, dir = p[:idx], "ASC"
				case "desc":
					col, dir = p[:idx], "DESC"
				}
			}
			if !allowlist[col] {
				return nil, fmt.Errorf("unknown column in order: %q", col)
			}
			clauses = append(clauses, fmt.Sprintf("`%s` %s", col, dir))
		}
		pq.OrderBy = strings.Join(clauses, ", ")
	}

	if l := values.Get("limit"); l != "" {
		n, err := strconv.Atoi(l)
		if err != nil || n < 0 {
			return nil, fmt.Errorf("invalid limit: %q", l)
		}
		pq.Limit = n
	}
	if o := values.Get("offset"); o != "" {
		n, err := strconv.Atoi(o)
		if err != nil || n < 0 {
			return nil, fmt.Errorf("invalid offset: %q", o)
		}
		pq.Offset = n
	}

	// Sort keys for a deterministic WHERE clause shape.
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var whereClauses []string
	for _, key := range keys {
		if specialParams[key] {
			continue
		}
		if !allowlist[key] {
			return nil, fmt.Errorf("unknown column: %q", key)
		}
		for _, raw := range values[key] {
			clause, args, err := parseCondition(key, raw)
			if err != nil {
				return nil, err
			}
			whereClauses = append(whereClauses, clause)
			pq.WhereArgs = append(pq.WhereArgs, args...)
		}
	}
	pq.Where = strings.Join(whereClauses, " AND ")

	return pq, nil
}

func parseCondition(col, raw string) (string, []any, error) {
	op, val := "eq", raw
	if idx := strings.Index(raw, "."); idx != -1 && validOps[raw[:idx]] {
		op, val = raw[:idx], raw[idx+1:]
	}

	quoted := "`" + col + "`"

	switch op {
	case "eq":
		return quoted + " = ?", []any{val}, nil
	case "neq":
		return quoted + " != ?", []any{val}, nil
	case "gt":
		return quoted + " > ?", []any{val}, nil
	case "gte":
		return quoted + " >= ?", []any{val}, nil
	case "lt":
		return quoted + " < ?", []any{val}, nil
	case "lte":
		return quoted + " <= ?", []any{val}, nil
	case "like":
		return quoted + " LIKE ?", []any{val}, nil
	case "in":
		val = strings.TrimSuffix(strings.TrimPrefix(val, "("), ")")
		if val == "" {
			return "", nil, fmt.Errorf("empty IN list for column %q", col)
		}
		items := strings.Split(val, ",")
		placeholders := make([]string, len(items))
		args := make([]any, len(items))
		for i, it := range items {
			placeholders[i] = "?"
			args[i] = strings.TrimSpace(it)
		}
		return quoted + " IN (" + strings.Join(placeholders, ", ") + ")", args, nil
	case "is":
		switch strings.ToLower(val) {
		case "null":
			return quoted + " IS NULL", nil, nil
		case "notnull":
			return quoted + " IS NOT NULL", nil, nil
		default:
			return "", nil, fmt.Errorf("invalid is.* value for column %q: %q", col, val)
		}
	default:
		return "", nil, fmt.Errorf("unsupported operator %q", op)
	}
}
