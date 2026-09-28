import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runStatus } from '../src/commands/status'
import { checksumContents } from '../src/lib/migrations'

const MIGRATION_SQL = '-- +migrate Up\nCREATE TABLE users (id INT);\n-- +migrate Down\nDROP TABLE users;'

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response
}

const COLUMNS = ['version', 'name', 'applied_at', 'execution_time_ms', 'checksum']

// Regression for bug B: a single-stage config must not crash `migrate
// status`. Exercises the full command path (loadConfig -> buildDbStatusReport
// -> printReport -> logger.table), not just the lib/report.ts data layer.
describe('migrate status (bug B regression: single-stage config)', () => {
  let dir: string
  let configPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'massicloud-cli-status-test-'))

    writeFileSync(join(dir, '20260927120000_001_create_users.sql'), MIGRATION_SQL)

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
          return jsonResponse(200, { command: 'SELECT', columns: COLUMNS, rows: [] })
        }
        throw new Error(`unexpected query in test: ${query}`)
      }),
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllGlobals()
    process.exitCode = undefined
  })

  it('renders a single-stage table without throwing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runStatus({ configPath, db: 'main' })).resolves.toBeUndefined()

    expect(process.exitCode).toBeUndefined()
    const output = logSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('production')
    expect(output).toContain('20260927120000_001_create_users')
    expect(output).toContain('pending')

    logSpy.mockRestore()
  })

  // Regression for the /query columns+positional-rows contract: a row like
  // ["20260927120000_001_create_users", "create_users", ...] must be zipped
  // against `columns` into an object, not misread as garbage/undefined.
  it('renders a single applied migration correctly from positional rows', async () => {
    const checksum = checksumContents(MIGRATION_SQL)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const { query } = JSON.parse(init.body)
        if (/CREATE SCHEMA/.test(query)) return jsonResponse(200, { command: 'CREATE', rowCount: 0 })
        if (/SELECT version, name, applied_at/.test(query)) {
          return jsonResponse(200, {
            command: 'SELECT',
            columns: COLUMNS,
            rows: [
              ['20260927120000_001_create_users', 'create_users', '2026-09-28T00:00:00Z', 5, checksum],
            ],
          })
        }
        throw new Error(`unexpected query in test: ${query}`)
      }),
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runStatus({ configPath, db: 'main' })).resolves.toBeUndefined()

    expect(process.exitCode).toBeUndefined()
    const lines = logSpy.mock.calls.map((call) => call[0])
    // Exactly one data row (plus the header) — no phantom "(unknown)"/MISSING row.
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('20260927120000_001_create_users')
    expect(lines[1]).toContain('create_users')
    expect(lines[1]).toContain('✓')
    expect(lines[1]).not.toContain('MISSING')
    expect(lines[1]).not.toContain('(unknown)')

    logSpy.mockRestore()
  })

  it('renders NOT PROVISIONED ("—") for the sole stage without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, { error: 'no stage named production in this project' })),
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runStatus({ configPath, db: 'main' })).resolves.toBeUndefined()

    expect(process.exitCode).toBeUndefined()
    const output = logSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('—')

    logSpy.mockRestore()
  })
})
