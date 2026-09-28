import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MigrationFileError } from '../src/lib/errors'
import {
  checksumContents,
  createMigrationFile,
  diffMigrations,
  formatTimestamp,
  listMigrationFiles,
  loadMigrations,
  nextSequence,
  parseFilename,
  parseMigrationSql,
  type AppliedMigration,
} from '../src/lib/migrations'

describe('parseFilename', () => {
  it('parses a well-formed migration filename', () => {
    const file = parseFilename('20260927120000_001_create_users.sql', '/migrations')
    expect(file).toEqual({
      version: '20260927120000_001_create_users',
      name: 'create_users',
      filename: '20260927120000_001_create_users.sql',
      path: '/migrations/20260927120000_001_create_users.sql',
    })
  })

  // Regression for bug C: version must be the full filename (sans .sql),
  // not just timestamp_seq — otherwise it's not a stable, self-describing
  // primary key across `up`/`down`/`status`.
  it('uses the full filename (without .sql) as the version, not just timestamp_seq', () => {
    const file = parseFilename('20260928110519_001_create_cli_test_table.sql', '/migrations')
    expect(file.version).toBe('20260928110519_001_create_cli_test_table')
  })

  it('rejects filenames that do not match the pattern', () => {
    expect(() => parseFilename('not-a-migration.sql', '/migrations')).toThrow(MigrationFileError)
  })
})

describe('parseMigrationSql', () => {
  it('splits Up and Down sections', () => {
    const { up, down } = parseMigrationSql(
      '-- +migrate Up\nCREATE TABLE t (id INT);\n\n-- +migrate Down\nDROP TABLE t;',
    )
    expect(up).toBe('CREATE TABLE t (id INT);')
    expect(down).toBe('DROP TABLE t;')
  })

  it('throws when the Up marker is missing', () => {
    expect(() => parseMigrationSql('-- +migrate Down\nDROP TABLE t;')).toThrow(MigrationFileError)
  })

  it('throws when the Down marker is missing', () => {
    expect(() => parseMigrationSql('-- +migrate Up\nCREATE TABLE t (id INT);')).toThrow(
      MigrationFileError,
    )
  })
})

describe('checksumContents', () => {
  it('is deterministic and ignores surrounding whitespace', () => {
    const a = checksumContents('-- +migrate Up\nSELECT 1;\n')
    const b = checksumContents('-- +migrate Up\nSELECT 1;')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when contents change', () => {
    expect(checksumContents('a')).not.toBe(checksumContents('b'))
  })
})

describe('formatTimestamp', () => {
  it('formats a UTC date as YYYYMMDDHHMMSS', () => {
    expect(formatTimestamp(new Date('2026-09-27T12:34:56Z'))).toBe('20260927123456')
  })
})

describe('with a temp migrations directory', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'massicloud-cli-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('lists migration files sorted by filename', () => {
    writeFileSync(join(dir, '20260927120000_002_second.sql'), 'x')
    writeFileSync(join(dir, '20260927120000_001_first.sql'), 'x')
    const files = listMigrationFiles(dir)
    expect(files.map((f) => f.name)).toEqual(['first', 'second'])
  })

  it('returns an empty list for a missing directory', () => {
    expect(listMigrationFiles(join(dir, 'nope'))).toEqual([])
  })

  it('computes the next sequence across the whole directory, starting at 001', () => {
    expect(nextSequence(dir)).toBe('001')
    writeFileSync(join(dir, '20260927120000_001_first.sql'), 'x')
    writeFileSync(join(dir, '20260927130000_005_gap.sql'), 'x')
    expect(nextSequence(dir)).toBe('006')
  })

  it('still finds the sequence when the name itself contains underscores', () => {
    // version is now the full filename (e.g. "..._005_create_orders_table"),
    // so nextSequence must not be fooled by extra underscores in the name.
    writeFileSync(join(dir, '20260927130000_005_create_orders_table.sql'), 'x')
    expect(nextSequence(dir)).toBe('006')
  })

  it('creates a migration file from the template with both markers', () => {
    const template = '-- +migrate Up\n\n\n-- +migrate Down\n'
    const file = createMigrationFile(dir, 'Create Users', template, new Date('2026-09-27T12:00:00Z'))
    expect(file.filename).toBe('20260927120000_001_create_users.sql')
    expect(file.version).toBe('20260927120000_001_create_users')
    const [loaded] = loadMigrations(dir)
    expect(loaded.up).toBe('')
    expect(loaded.down).toBe('')
    expect(loaded.version).toBe('20260927120000_001_create_users')
  })

  it('increments the sequence for successive new migrations', () => {
    const template = '-- +migrate Up\nSELECT 1;\n-- +migrate Down\nSELECT 1;'
    createMigrationFile(dir, 'first', template, new Date('2026-09-27T12:00:00Z'))
    const second = createMigrationFile(dir, 'second', template, new Date('2026-09-27T12:00:01Z'))
    expect(second.filename).toContain('_002_second.sql')
  })
})

describe('diffMigrations', () => {
  const local = [
    { version: '20260927120000_001', name: 'a', filename: 'a.sql', path: 'a.sql', up: '', down: '', checksum: 'sum-a' },
    { version: '20260927130000_002', name: 'b', filename: 'b.sql', path: 'b.sql', up: '', down: '', checksum: 'sum-b' },
  ]

  it('reports migrations with no local file as missingLocal', () => {
    const applied: AppliedMigration[] = [
      { version: '20260927110000_000', name: 'zero', applied_at: '', execution_time_ms: 1, checksum: 'x' },
    ]
    const { missingLocal, pending, checksumMismatches } = diffMigrations(local, applied)
    expect(missingLocal).toHaveLength(1)
    expect(checksumMismatches).toHaveLength(0)
    expect(pending.map((m) => m.version)).toEqual(local.map((m) => m.version))
  })

  it('reports checksum mismatches for applied migrations whose local checksum changed', () => {
    const applied: AppliedMigration[] = [
      { version: local[0].version, name: 'a', applied_at: '', execution_time_ms: 1, checksum: 'different' },
    ]
    const { checksumMismatches, pending } = diffMigrations(local, applied)
    expect(checksumMismatches).toHaveLength(1)
    expect(checksumMismatches[0].local.version).toBe(local[0].version)
    expect(pending.map((m) => m.version)).toEqual([local[1].version])
  })

  it('treats already-applied migrations with matching checksums as not pending', () => {
    const applied: AppliedMigration[] = [
      { version: local[0].version, name: 'a', applied_at: '', execution_time_ms: 1, checksum: 'sum-a' },
    ]
    const { pending, missingLocal, checksumMismatches } = diffMigrations(local, applied)
    expect(pending.map((m) => m.version)).toEqual([local[1].version])
    expect(missingLocal).toHaveLength(0)
    expect(checksumMismatches).toHaveLength(0)
  })
})
