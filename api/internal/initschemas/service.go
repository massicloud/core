package initschemas

import (
	"context"
	"embed"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mikaminou/massicloud/api/internal/proxy"
)

//go:embed sql/*.sql
var sqlFiles embed.FS

// SchemaKind identifies optional schemas a customer can request.
type SchemaKind string

const (
	SchemaAuth       SchemaKind = "auth"
	SchemaAudit      SchemaKind = "audit"
	SchemaCompliance SchemaKind = "compliance"
)

func (k SchemaKind) Valid() bool {
	switch k {
	case SchemaAuth, SchemaAudit, SchemaCompliance:
		return true
	}
	return false
}

type Service struct {
	proxy  *proxy.PostgresProxy
	logger *slog.Logger
}

func New(p *proxy.PostgresProxy, logger *slog.Logger) *Service {
	return &Service{proxy: p, logger: logger}
}

// Initialize runs the always-on extensions plus any optional schemas.
// Safe to call multiple times — all SQL uses IF NOT EXISTS / OR REPLACE.
func (s *Service) Initialize(
	ctx context.Context,
	instanceID string,
	schemas []SchemaKind,
) error {
	pool, err := s.proxy.GetPool(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("initschemas: get pool: %w", err)
	}

	if err := s.runFile(ctx, pool, "sql/extensions.sql"); err != nil {
		return fmt.Errorf("initschemas: extensions: %w", err)
	}
	s.logger.Info("init: extensions enabled", slog.String("instance_id", instanceID))

	for _, kind := range schemas {
		if !kind.Valid() {
			return fmt.Errorf("initschemas: invalid schema %q", kind)
		}
		file := fmt.Sprintf("sql/%s.sql", kind)
		if err := s.runFile(ctx, pool, file); err != nil {
			return fmt.Errorf("initschemas: %s: %w", kind, err)
		}
		s.logger.Info("init: schema created",
			slog.String("instance_id", instanceID),
			slog.String("schema", string(kind)),
		)
	}

	return nil
}

// Apply installs extensions and a single named schema preset (e.g. "auth").
// Used by the stage provisioning flow. Idempotent.
func (s *Service) Apply(ctx context.Context, instanceID, schemaName string) error {
	return s.Initialize(ctx, instanceID, []SchemaKind{SchemaKind(schemaName)})
}

// ApplyExtensionsOnly installs the standard extensions without any schema.
// Used for "blank" preset instances so extensions are always available.
func (s *Service) ApplyExtensionsOnly(ctx context.Context, instanceID string) error {
	return s.Initialize(ctx, instanceID, nil)
}

// RemovePool evicts the cached pool for a deleted instance.
func (s *Service) RemovePool(instanceID string) {
	s.proxy.Remove(instanceID)
}

func (s *Service) runFile(ctx context.Context, pool *pgxpool.Pool, path string) error {
	content, err := sqlFiles.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if _, err := pool.Exec(ctx, string(content)); err != nil {
		return fmt.Errorf("exec %s: %w", path, err)
	}
	return nil
}
