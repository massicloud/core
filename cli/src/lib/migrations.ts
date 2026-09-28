import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ChecksumMismatchError, MigrationFileError, MissingLocalMigrationError } from './errors'

export interface MigrationFile {
  /**
   * Full sortable identifier used as the state table's primary key —
   * the filename without its ".sql" extension, e.g.
   * "20260927120000_001_create_users". Includes the name (not just
   * timestamp_seq) so it's unambiguous on its own and there's only one
   * place (here) that derives it from a filename.
   */
  version: string
  name: string
  filename: string
  path: string
}

export interface ParsedMigration extends MigrationFile {
  up: string
  down: string
  checksum: string
}

export interface AppliedMigration {
  version: string
  name: string
  applied_at: string
  execution_time_ms: number
  checksum: string
}

const FILENAME_RE = /^(\d{14})_(\d{3})_([A-Za-z0-9_-]+)\.sql$/
const UP_MARKER = '-- +migrate Up'
const DOWN_MARKER = '-- +migrate Down'

/** Lists migration files in `dir`, sorted ascending by filename (= chronological). */
export function listMigrationFiles(dir: string): MigrationFile[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return []
    throw err
  }

  return entries
    .filter((filename) => filename.endsWith('.sql'))
    .map((filename) => parseFilename(filename, dir))
    .sort((a, b) => a.filename.localeCompare(b.filename))
}

export function parseFilename(filename: string, dir: string): MigrationFile {
  const match = FILENAME_RE.exec(filename)
  if (!match) {
    throw new MigrationFileError(
      `Migration filename "${filename}" doesn't match the expected pattern ` +
        `YYYYMMDDHHMMSS_NNN_name.sql`,
    )
  }
  const [, , , name] = match
  return {
    version: filename.replace(/\.sql$/, ''),
    name,
    filename,
    path: join(dir, filename),
  }
}

/** Splits a migration file's contents into its Up and Down sections. */
export function parseMigrationSql(contents: string): { up: string; down: string } {
  const upIndex = contents.indexOf(UP_MARKER)
  const downIndex = contents.indexOf(DOWN_MARKER)

  if (upIndex === -1) {
    throw new MigrationFileError(`Migration is missing the "${UP_MARKER}" marker`)
  }
  if (downIndex === -1) {
    throw new MigrationFileError(`Migration is missing the "${DOWN_MARKER}" marker`)
  }
  if (downIndex < upIndex) {
    throw new MigrationFileError(`"${DOWN_MARKER}" marker must come after "${UP_MARKER}"`)
  }

  const up = contents.slice(upIndex + UP_MARKER.length, downIndex).trim()
  const down = contents.slice(downIndex + DOWN_MARKER.length).trim()
  return { up, down }
}

/** SHA256 hex digest of a migration file's full raw contents. */
export function checksumContents(contents: string): string {
  return createHash('sha256').update(contents.trim(), 'utf8').digest('hex')
}

export function loadMigration(file: MigrationFile): ParsedMigration {
  const contents = readFileSync(file.path, 'utf8')
  const { up, down } = parseMigrationSql(contents)
  return { ...file, up, down, checksum: checksumContents(contents) }
}

export function loadMigrations(dir: string): ParsedMigration[] {
  return listMigrationFiles(dir).map(loadMigration)
}

/** Next zero-padded sequence number for a new migration in `dir`. */
export function nextSequence(dir: string): string {
  const files = listMigrationFiles(dir)
  const max = files.reduce((acc, file) => {
    const seq = Number(file.version.split('_')[1])
    return Number.isFinite(seq) ? Math.max(acc, seq) : acc
  }, 0)
  return String(max + 1).padStart(3, '0')
}

/** YYYYMMDDHHMMSS in UTC. */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  )
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function createMigrationFile(
  dir: string,
  name: string,
  template: string,
  date: Date = new Date(),
): MigrationFile {
  mkdirSync(dir, { recursive: true })
  const slug = slugifyName(name)
  if (!slug) {
    throw new MigrationFileError('Migration name must contain at least one alphanumeric character')
  }
  const timestamp = formatTimestamp(date)
  const seq = nextSequence(dir)
  const filename = `${timestamp}_${seq}_${slug}.sql`
  const path = join(dir, filename)
  writeFileSync(path, template.replace(/__NAME__/g, name), 'utf8')
  return { version: `${timestamp}_${seq}_${slug}`, name: slug, filename, path }
}

export interface Divergence {
  pending: ParsedMigration[]
  missingLocal: AppliedMigration[]
  checksumMismatches: Array<{ local: ParsedMigration; applied: AppliedMigration }>
}

/**
 * Compares local migration files against what the server has recorded as
 * applied. Every already-applied migration must exist locally with a
 * matching checksum (D9 / D6); anything left over locally and not applied
 * is pending.
 */
export function diffMigrations(
  local: ParsedMigration[],
  applied: AppliedMigration[],
): Divergence {
  const localByVersion = new Map(local.map((m) => [m.version, m]))
  const appliedVersions = new Set(applied.map((m) => m.version))

  const missingLocal: AppliedMigration[] = []
  const checksumMismatches: Array<{ local: ParsedMigration; applied: AppliedMigration }> = []

  for (const appliedMigration of applied) {
    const localMigration = localByVersion.get(appliedMigration.version)
    if (!localMigration) {
      missingLocal.push(appliedMigration)
      continue
    }
    if (localMigration.checksum !== appliedMigration.checksum) {
      checksumMismatches.push({ local: localMigration, applied: appliedMigration })
    }
  }

  const pending = local
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version.localeCompare(b.version))

  return { pending, missingLocal, checksumMismatches }
}

/** Throws ChecksumMismatchError / MissingLocalMigrationError if not clean. */
export function assertNoDivergence(divergence: Divergence): void {
  if (divergence.missingLocal.length > 0) {
    const versions = divergence.missingLocal.map((m) => m.version).join(', ')
    throw new MissingLocalMigrationError(
      `Server has applied migration(s) with no local file: ${versions}`,
    )
  }
  if (divergence.checksumMismatches.length > 0) {
    const versions = divergence.checksumMismatches.map((m) => m.local.version).join(', ')
    throw new ChecksumMismatchError(
      `Checksum mismatch for migration(s): ${versions}. The local file has changed since it was applied.`,
    )
  }
}
