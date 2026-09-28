import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MassiCloudConfig } from '../src/lib/config'
import { checksumContents } from '../src/lib/migrations'
import { buildDbStatusReport, buildOrphanReport } from '../src/lib/report'

const MIGRATION_A = '-- +migrate Up\nCREATE TABLE a (id INT);\n-- +migrate Down\nDROP TABLE a;'
const MIGRATION_B = '-- +migrate Up\nCREATE TABLE b (id INT);\n-- +migrate Down\nDROP TABLE b;'

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response
}

const COLUMNS = ['version', 'name', 'applied_at', 'execution_time_ms', 'checksum']

/** The real /query endpoint returns rows as positional arrays aligned with `columns`. */
function toPositionalRows(records: Record<string, unknown>[]): unknown[][] {
  return records.map((record) => COLUMNS.map((col) => record[col]))
}

/**
 * Fakes the /query endpoint, tracking applied rows per stage from the
 * request URL. Stages named in `unprovisioned` 404 on every query, the
 * way an unprovisioned stage does on the real API.
 */
function makeFetch(
  appliedByStage: Record<string, Record<string, unknown>[]>,
  unprovisioned: string[] = [],
) {
  return vi.fn(async (url: string, init: { body: string }) => {
    const stage = /\/([^/]+)\/db\//.exec(url)?.[1]
    const { query } = JSON.parse(init.body)

    if (stage && unprovisioned.includes(stage)) {
      return jsonResponse(404, { error: `no stage named ${stage} in this project` })
    }
    if (/CREATE SCHEMA/.test(query)) return jsonResponse(200, { command: 'CREATE', rowCount: 0 })
    if (/SELECT version, name, applied_at/.test(query)) {
      return jsonResponse(200, {
        command: 'SELECT',
        columns: COLUMNS,
        rows: toPositionalRows(appliedByStage[stage!] ?? []),
      })
    }
    throw new Error(`unexpected query in test: ${query}`)
  })
}

describe('lib/report', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'massicloud-cli-report-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  function config(stages: string[]): MassiCloudConfig {
    return {
      url: 'https://api.massicloud.work/v1/acme',
      service_key: 'mc_service_test',
      stages,
      databases: { main: { migrations_dir: dir } },
    }
  }

  describe('buildDbStatusReport', () => {
    it('marks a migration applied cleanly in one stage and pending in another', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)
      const checksum = checksumContents(MIGRATION_A)

      vi.stubGlobal(
        'fetch',
        makeFetch({
          development: [
            { version: '20260927120000_001_a', name: 'a', applied_at: '', execution_time_ms: 1, checksum },
          ],
          production: [],
        }),
      )

      const report = await buildDbStatusReport(config(['development', 'production']), 'main')

      expect(report.rows).toHaveLength(1)
      expect(report.rows[0].cells).toEqual({ development: 'ok', production: 'pending' })
      expect(report.dirty).toBe(false)
    })

    it('marks a version MISSING when applied on the server but the local file is gone', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetch({
          development: [],
          production: [
            { version: '20260927120000_001_deleted', name: 'deleted', applied_at: '', execution_time_ms: 1, checksum: 'x' },
          ],
        }),
      )

      const report = await buildDbStatusReport(config(['development', 'production']), 'main')

      expect(report.rows).toHaveLength(1)
      expect(report.rows[0].name).toBe('deleted')
      expect(report.rows[0].cells).toEqual({ development: 'pending', production: 'missing' })
      expect(report.dirty).toBe(true)
    })

    it('marks a version MISMATCH when the local checksum no longer matches', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)

      vi.stubGlobal(
        'fetch',
        makeFetch({
          production: [
            { version: '20260927120000_001_a', name: 'a', applied_at: '', execution_time_ms: 1, checksum: 'stale-checksum' },
          ],
        }),
      )

      const report = await buildDbStatusReport(config(['production']), 'main')

      expect(report.rows[0].cells.production).toBe('mismatch')
      expect(report.dirty).toBe(true)
    })

    it('sorts rows by version and covers multiple local migrations', async () => {
      writeFileSync(join(dir, '20260927130000_002_b.sql'), MIGRATION_B)
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)

      vi.stubGlobal('fetch', makeFetch({ production: [] }))

      const report = await buildDbStatusReport(config(['production']), 'main')

      expect(report.rows.map((r) => r.version)).toEqual(['20260927120000_001_a', '20260927130000_002_b'])
    })

    // Regression for bug A: an unprovisioned stage 404s on /query; that
    // must render as a "not_provisioned" cell, not throw.
    it('marks an unprovisioned stage as not_provisioned instead of throwing', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)
      const checksum = checksumContents(MIGRATION_A)

      vi.stubGlobal(
        'fetch',
        makeFetch(
          {
            development: [
              { version: '20260927120000_001_a', name: 'a', applied_at: '', execution_time_ms: 1, checksum },
            ],
          },
          ['staging'],
        ),
      )

      const report = await buildDbStatusReport(config(['development', 'staging']), 'main')

      expect(report.rows[0].cells).toEqual({ development: 'ok', staging: 'not_provisioned' })
      // Not being provisioned yet isn't itself divergence.
      expect(report.dirty).toBe(false)
    })

    // Regression for bug B: single-stage config, and that sole stage is
    // unprovisioned. Must render one complete row, not crash.
    it('handles a single-stage config where the only stage is unprovisioned', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)

      vi.stubGlobal('fetch', makeFetch({}, ['production']))

      const report = await buildDbStatusReport(config(['production']), 'main')

      expect(report.stages).toEqual(['production'])
      expect(report.rows).toHaveLength(1)
      expect(report.rows[0].cells).toEqual({ production: 'not_provisioned' })
      expect(report.dirty).toBe(false)
    })
  })

  describe('buildOrphanReport', () => {
    it('groups local migrations into safe-to-delete vs. in-use by stage', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)
      writeFileSync(join(dir, '20260927130000_002_b.sql'), MIGRATION_B)
      const checksumA = checksumContents(MIGRATION_A)

      vi.stubGlobal(
        'fetch',
        makeFetch({
          development: [
            { version: '20260927120000_001_a', name: 'a', applied_at: '', execution_time_ms: 1, checksum: checksumA },
          ],
          staging: [],
          production: [],
        }),
      )

      const report = await buildOrphanReport(config(['development', 'staging', 'production']), 'main')

      expect(report.safeToDelete.map((m) => m.filename)).toEqual(['20260927130000_002_b.sql'])
      expect(report.inUse).toHaveLength(1)
      expect(report.inUse[0].migration.filename).toBe('20260927120000_001_a.sql')
      expect(report.inUse[0].stages).toEqual(['development'])
    })

    it('treats an unprovisioned stage as "not applied there" instead of throwing', async () => {
      writeFileSync(join(dir, '20260927120000_001_a.sql'), MIGRATION_A)

      vi.stubGlobal('fetch', makeFetch({ development: [] }, ['staging']))

      const report = await buildOrphanReport(config(['development', 'staging']), 'main')

      expect(report.safeToDelete.map((m) => m.filename)).toEqual(['20260927120000_001_a.sql'])
      expect(report.inUse).toHaveLength(0)
    })
  })
})
