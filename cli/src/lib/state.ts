import type { MassiCloudApiClient } from './client'
import type { AppliedMigration } from './migrations'

export const ENSURE_STATE_SQL = `
CREATE SCHEMA IF NOT EXISTS massicloud;
CREATE TABLE IF NOT EXISTS massicloud.migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER NOT NULL,
  checksum TEXT NOT NULL
);
`.trim()

/** Escapes a value as a Postgres string literal, e.g. `it's` -> `'it''s'`. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildSelectAppliedSql(): string {
  return 'SELECT version, name, applied_at, execution_time_ms, checksum FROM massicloud.migrations ORDER BY version;'
}

export function buildInsertAppliedSql(input: {
  version: string
  name: string
  checksum: string
  executionTimeMs: number
}): string {
  return (
    'INSERT INTO massicloud.migrations (version, name, execution_time_ms, checksum) ' +
    `VALUES (${sqlLiteral(input.version)}, ${sqlLiteral(input.name)}, ${input.executionTimeMs}, ${sqlLiteral(input.checksum)});`
  )
}

export function buildDeleteAppliedSql(version: string): string {
  return `DELETE FROM massicloud.migrations WHERE version = ${sqlLiteral(version)};`
}

export async function ensureStateTable(client: MassiCloudApiClient): Promise<void> {
  await client.query(ENSURE_STATE_SQL)
}

/**
 * Rows come back as positional arrays aligned with `columns` (like a raw
 * Postgres result set), not objects — zip them into the shape callers
 * actually want.
 */
export async function fetchAppliedMigrations(
  client: MassiCloudApiClient,
): Promise<AppliedMigration[]> {
  const result = await client.query(buildSelectAppliedSql())
  const columns = result.columns ?? []
  const rows = result.rows ?? []

  return rows.map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((column, i) => {
      record[column] = row[i]
    })
    return record as unknown as AppliedMigration
  })
}

export async function recordApplied(
  client: MassiCloudApiClient,
  input: { version: string; name: string; checksum: string; executionTimeMs: number },
): Promise<void> {
  await client.query(buildInsertAppliedSql(input))
}

export async function recordRolledBack(
  client: MassiCloudApiClient,
  version: string,
): Promise<void> {
  await client.query(buildDeleteAppliedSql(version))
}
