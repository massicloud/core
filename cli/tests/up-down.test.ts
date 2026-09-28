import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runDown } from '../src/commands/down'
import { runUp } from '../src/commands/up'

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response
}

interface StateRow {
  version: string
  name: string
  applied_at: string
  execution_time_ms: number
  checksum: string
}

const COLUMNS = ['version', 'name', 'applied_at', 'execution_time_ms', 'checksum'] as const

// Regression for bug C: `up` and `down` must key applied migrations by the
// exact same version string, or `down` (and status/verify) can't find what
// `up` just recorded.
describe('migrate up -> migrate down round-trip (bug C regression)', () => {
  let dir: string
  let configPath: string
  let state: StateRow[]

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'massicloud-cli-updown-test-'))
    state = []

    writeFileSync(
      join(dir, '20260928110519_001_create_cli_test_table.sql'),
      '-- +migrate Up\nCREATE TABLE cli_test (id INT);\n-- +migrate Down\nDROP TABLE cli_test;',
    )

    configPath = join(dir, 'massicloud.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        url: 'https://api.massicloud.work/v1/acme',
        service_key: 'mc_service_test',
        stages: ['production'],
        databases: { main: { migrations_dir: dir } },
      }),
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const { query } = JSON.parse(init.body)

        if (/CREATE SCHEMA/.test(query)) return jsonResponse(200, { command: 'CREATE', rowCount: 0 })
        if (/SELECT version, name, applied_at/.test(query)) {
          // The real /query endpoint returns rows as positional arrays
          // aligned with `columns`, not objects.
          return jsonResponse(200, {
            command: 'SELECT',
            columns: COLUMNS,
            rows: state.map((row) => COLUMNS.map((col) => row[col])),
          })
        }
        if (/INSERT INTO massicloud\.migrations/.test(query)) {
          const m = query.match(/VALUES \('([^']+)', '((?:[^']|'')*)', (\d+), '([^']+)'\)/)!
          state.push({
            version: m[1],
            name: m[2].replace(/''/g, "'"),
            applied_at: new Date().toISOString(),
            execution_time_ms: Number(m[3]),
            checksum: m[4],
          })
          return jsonResponse(200, { command: 'INSERT', rowCount: 1 })
        }
        if (/DELETE FROM massicloud\.migrations/.test(query)) {
          const m = query.match(/version = '([^']+)'/)!
          state = state.filter((row) => row.version !== m[1])
          return jsonResponse(200, { command: 'DELETE', rowCount: 1 })
        }
        // The migration's own Up/Down SQL body.
        return jsonResponse(200, { command: 'OK', rowCount: 0 })
      }),
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllGlobals()
    process.exitCode = undefined
  })

  it('stores the full filename (sans .sql) as version, and down finds it again', async () => {
    await runUp({ configPath, stage: 'production', db: 'main' })

    expect(state).toHaveLength(1)
    expect(state[0].version).toBe('20260928110519_001_create_cli_test_table')
    expect(process.exitCode).toBeUndefined()

    // This is the exact bug C repro: `migrate down` right after `migrate up`
    // on the same file must not throw "no local file" for a version it just
    // wrote itself.
    await expect(runDown({ configPath, stage: 'production', db: 'main' })).resolves.toBeUndefined()

    expect(process.exitCode).toBeUndefined()
    expect(state).toHaveLength(0)
  })
})
