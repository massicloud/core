import { loadConfig, resolveDbNames } from '../lib/config'
import * as logger from '../lib/logger'
import { buildDbStatusReport, type CellStatus, type DbStatusReport } from '../lib/report'

export interface StatusOptions {
  configPath: string
  db?: string
}

const CELL_LABEL: Record<CellStatus, string> = {
  ok: '✓',
  pending: 'pending',
  missing: 'MISSING',
  mismatch: 'MISMATCH',
  not_provisioned: '—',
}

function printReport(report: DbStatusReport): void {
  const header = ['Version', 'Name', ...report.stages]
  const rows = report.rows.map((row) => [
    row.version,
    row.name,
    ...report.stages.map((stage) => CELL_LABEL[row.cells[stage]]),
  ])
  logger.table([header, ...rows])
}

export async function runStatus(options: StatusOptions): Promise<void> {
  const config = loadConfig({ configPath: options.configPath })
  const dbs = resolveDbNames(config, options.db)

  let anyDirty = false

  for (const db of dbs) {
    if (dbs.length > 1) logger.info(`=== Database: ${db} ===`)
    const report = await buildDbStatusReport(config, db)
    printReport(report)
    if (report.dirty) anyDirty = true
    if (dbs.length > 1) logger.info('')
  }

  if (anyDirty) process.exitCode = 1
}
