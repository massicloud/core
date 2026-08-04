package initschemas

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLPreset struct {
	ID          string
	Label       string
	Description string
	Schema      string
}

var MySQLPresets = map[string]MySQLPreset{
	"blank": {
		ID:          "blank",
		Label:       "Blank",
		Description: "Empty database. Create your own tables.",
		Schema:      "",
	},
	"users_basic": {
		ID:          "users_basic",
		Label:       "Users (basic)",
		Description: "Auth-ready users table with id, email, timestamps.",
		Schema: `
			CREATE TABLE users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				email VARCHAR(255) NOT NULL UNIQUE,
				password_hash VARCHAR(255) NOT NULL,
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
					ON UPDATE CURRENT_TIMESTAMP
			);
		`,
	},
}

// ListMySQLPresets returns every MySQL preset, tagged database_type="mysql".
func ListMySQLPresets() []SchemaPreset {
	order := []string{"blank", "users_basic"}
	result := make([]SchemaPreset, 0, len(order))
	for _, id := range order {
		p := MySQLPresets[id]
		result = append(result, SchemaPreset{
			ID:           p.ID,
			Label:        p.Label,
			Description:  p.Description,
			DatabaseType: "mysql",
		})
	}
	return result
}

// ApplyMySQLPreset connects directly to dsn (the tenant's root DSN — schema
// init is a one-shot operation, no pooling needed) and runs the preset's
// DDL. Unlike the Postgres path, MySQL instances don't go through
// proxy.PostgresProxy since that's pgx/Postgres-specific.
func (s *Service) ApplyMySQLPreset(ctx context.Context, dsn, presetID string) error {
	preset, ok := MySQLPresets[presetID]
	if !ok {
		return fmt.Errorf("initschemas: unknown mysql preset %q", presetID)
	}
	if preset.Schema == "" {
		return nil
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("initschemas: open mysql: %w", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, preset.Schema); err != nil {
		return fmt.Errorf("initschemas: apply mysql preset %q: %w", presetID, err)
	}
	s.logger.Info("init: mysql schema preset applied", slog.String("preset", presetID))
	return nil
}
