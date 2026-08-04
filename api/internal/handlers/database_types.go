package handlers

import "database/sql"

// Database Explorer Types

type Table struct {
	Name      string `json:"name"`
	RowCount  int64  `json:"row_count"`
	SizeBytes int64  `json:"size_bytes"`
	Comment   string `json:"comment"`
}

type Column struct {
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Length         *int    `json:"length"`
	Nullable       bool    `json:"nullable"`
	Default        *string `json:"default"`
	IsPrimaryKey   bool    `json:"is_primary_key"`
	IsUnique       bool    `json:"is_unique"`
}

type Index struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Columns   []string `json:"columns"`
	Unique    bool     `json:"unique"`
	Primary   bool     `json:"primary"`
	SizeBytes int64    `json:"size_bytes"`
}

type ForeignKey struct {
	Name             string `json:"name"`
	Column           string `json:"column"`
	ReferencedTable  string `json:"referenced_table"`
	ReferencedColumn string `json:"referenced_column"`
	OnDelete         string `json:"on_delete"`
	OnUpdate         string `json:"on_update"`
}

type CreateTableRequest struct {
	Name        string                  `json:"name"`
	Comment     string                  `json:"comment"`
	Columns     []ColumnDefinition      `json:"columns"`
	ForeignKeys []ForeignKeyDefinition  `json:"foreign_keys"`
	RLSEnabled  bool                    `json:"rls_enabled"`
}

type TableWithColumns struct {
	Schema  string        `json:"schema"`
	Name    string        `json:"name"`
	Columns []TableColumn `json:"columns"`
}

type TableColumn struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	IsPrimaryKey bool   `json:"is_primary_key"`
}

type ColumnDefinition struct {
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Length       *int    `json:"length"`
	Nullable     bool    `json:"nullable"`
	Default      *string `json:"default"`
	IsPrimaryKey bool    `json:"is_primary_key"`
	IsUnique     bool    `json:"is_unique"`
}

type CreateIndexRequest struct {
	Name       string   `json:"name"`
	Columns    []string `json:"columns"`
	Type       string   `json:"type"` // btree, hash, gin, gist, brin
	Unique     bool     `json:"unique"`
	Concurrent bool     `json:"concurrent"`
}

type QueryRequest struct {
	SQL string `json:"sql"`
}

type QueryResponse struct {
	Columns       []string        `json:"columns"`
	Rows          [][]interface{} `json:"rows"`
	RowCount      int             `json:"row_count"`
	ExecutionTime int64           `json:"execution_time_ms"`
	Error         string          `json:"error,omitempty"`
}

type ConnectionStatus struct {
	Connected bool   `json:"connected"`
	Version   string `json:"version"`
}

type RowsResult struct {
	Rows  []map[string]interface{} `json:"rows"`
	Total int64                    `json:"total"`
}

type ForeignKeyDefinition struct {
	Column           string `json:"column"`
	ReferencedTable  string `json:"referenced_table"`
	ReferencedColumn string `json:"referenced_column"`
	OnDelete         string `json:"on_delete"`
	OnUpdate         string `json:"on_update"`
}

type InsertRowRequest struct {
	Data map[string]interface{} `json:"data"`
}

type UpdateRowRequest struct {
	Data map[string]interface{} `json:"data"`
}

type BulkDeleteRequest struct {
	IDs []interface{} `json:"ids"`
}

// Helper to check if substring exists in string
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Helper to scan into interface slice
func scanRow(rows *sql.Rows, columns []string) (map[string]interface{}, error) {
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range columns {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	entry := make(map[string]interface{})
	for i, col := range columns {
		val := values[i]
		// lib/pq scans text-based columns (text, varchar, uuid, …) as []byte when
		// the destination is interface{}.  json.Marshal would then base64-encode them,
		// sending garbage to the frontend.  Convert to string so JSON stays clean.
		if b, ok := val.([]byte); ok {
			entry[col] = string(b)
		} else {
			entry[col] = val
		}
	}
	return entry, nil
}

