import chalk from 'chalk'
import { ApiError, ChecksumMismatchError, MissingLocalMigrationError, SqlError } from './errors'

export function info(message: string): void {
  console.log(message)
}

export function success(message: string): void {
  console.log(chalk.green(message))
}

export function warn(message: string): void {
  console.error(chalk.yellow(message))
}

export function fail(message: string): void {
  console.error(chalk.red(message))
}

/** Prints an error to stderr with any structured detail it carries. */
export function printError(err: unknown): void {
  if (err instanceof SqlError) {
    fail(`SQL error: ${err.message}`)
    if (err.code) fail(`  code:   ${err.code}`)
    if (err.detail) fail(`  detail: ${err.detail}`)
    if (err.hint) fail(`  hint:   ${err.hint}`)
    if (err.position !== undefined) fail(`  position: ${err.position}`)
    return
  }
  if (err instanceof MissingLocalMigrationError || err instanceof ChecksumMismatchError) {
    fail(err.message)
    return
  }
  if (err instanceof ApiError) {
    fail(`Request error${err.status ? ` (${err.status})` : ''}: ${err.message}`)
    return
  }
  fail(err instanceof Error ? err.message : String(err))
}

/**
 * Renders rows as space-padded columns. Tolerates ragged rows (fewer
 * cells than the widest row) by treating missing cells as empty strings,
 * rather than crashing on `undefined.length`.
 */
export function table(rows: string[][]): void {
  if (rows.length === 0) return
  const columnCount = Math.max(...rows.map((row) => row.length))
  const widths = Array.from({ length: columnCount }, (_, col) =>
    Math.max(...rows.map((row) => (row[col] ?? '').length)),
  )
  for (const row of rows) {
    info(
      Array.from({ length: columnCount }, (_, col) => (row[col] ?? '').padEnd(widths[col]))
        .join('  ')
        .trimEnd(),
    )
  }
}
