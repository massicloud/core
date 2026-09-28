import { describe, expect, it, vi } from 'vitest'
import { MassiCloudApiClient } from '../src/lib/client'
import type { ResolvedTarget } from '../src/lib/config'
import {
  buildDeleteAppliedSql,
  buildInsertAppliedSql,
  fetchAppliedMigrations,
  sqlLiteral,
} from '../src/lib/state'

const target: ResolvedTarget = {
  url: 'https://api.massicloud.work/v1/acme',
  service_key: 'mc_service_test',
  stage: 'production',
  db: 'main',
  migrations_dir: './migrations',
}

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response
}

describe('sqlLiteral', () => {
  it('wraps a plain value in single quotes', () => {
    expect(sqlLiteral('20260927120000_001')).toBe("'20260927120000_001'")
  })

  it('escapes embedded single quotes by doubling them', () => {
    expect(sqlLiteral("it's a test")).toBe("'it''s a test'")
  })
})

describe('buildInsertAppliedSql', () => {
  it('builds a parameterized-looking INSERT with escaped literals', () => {
    const sql = buildInsertAppliedSql({
      version: '20260927120000_001',
      name: "o'brien",
      checksum: 'abc123',
      executionTimeMs: 42,
    })
    expect(sql).toContain("VALUES ('20260927120000_001', 'o''brien', 42, 'abc123')")
  })
})

describe('buildDeleteAppliedSql', () => {
  it('builds a DELETE scoped to the version', () => {
    expect(buildDeleteAppliedSql('20260927120000_001')).toBe(
      "DELETE FROM massicloud.migrations WHERE version = '20260927120000_001';",
    )
  })
})

describe('fetchAppliedMigrations', () => {
  // Regression: the /query endpoint returns rows as positional arrays
  // aligned with `columns` (like a raw Postgres result set), NOT objects
  // keyed by column name. A naive `rows as AppliedMigration[]` cast used to
  // silently produce arrays where callers expected {version, name, ...}
  // objects, breaking every downstream `.version` lookup.
  it('zips columns and positional rows into AppliedMigration objects', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        command: 'SELECT',
        columns: ['version', 'name', 'applied_at', 'execution_time_ms', 'checksum'],
        rows: [['v1', 'n1', '2026-09-28T00:00:00Z', 5, 'sum1']],
      }),
    )
    const client = new MassiCloudApiClient(target, fetcher as unknown as typeof fetch)

    const result = await fetchAppliedMigrations(client)

    expect(result).toEqual([
      {
        version: 'v1',
        name: 'n1',
        applied_at: '2026-09-28T00:00:00Z',
        execution_time_ms: 5,
        checksum: 'sum1',
      },
    ])
    expect(Array.isArray(result[0])).toBe(false)
    expect((result[0] as unknown as unknown[])[0]).toBeUndefined()
  })

  it('zips multiple rows independently', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        command: 'SELECT',
        columns: ['version', 'name', 'applied_at', 'execution_time_ms', 'checksum'],
        rows: [
          ['v1', 'n1', '2026-09-28T00:00:00Z', 5, 'sum1'],
          ['v2', 'n2', '2026-09-28T00:01:00Z', 7, 'sum2'],
        ],
      }),
    )
    const client = new MassiCloudApiClient(target, fetcher as unknown as typeof fetch)

    const result = await fetchAppliedMigrations(client)

    expect(result.map((r) => r.version)).toEqual(['v1', 'v2'])
    expect(result.map((r) => r.name)).toEqual(['n1', 'n2'])
  })

  it('returns an empty array when there are no applied migrations', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, { command: 'SELECT', columns: ['version', 'name'], rows: [] }),
    )
    const client = new MassiCloudApiClient(target, fetcher as unknown as typeof fetch)

    expect(await fetchAppliedMigrations(client)).toEqual([])
  })
})
