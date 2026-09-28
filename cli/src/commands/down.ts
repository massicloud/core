import { loadConfig } from '../lib/config'
import * as logger from '../lib/logger'
import { assertNoDivergence, type AppliedMigration, type ParsedMigration } from '../lib/migrations'
import { buildSingleTargetReport } from '../lib/report'
import { recordRolledBack } from '../lib/state'

export interface DownOptions {
  configPath: string
  stage?: string
  db?: string
  to?: string
}

function selectToRollback(
  local: ParsedMigration[],
  applied: AppliedMigration[],
  to: string | undefined,
): ParsedMigration[] {
  const localByVersion = new Map(local.map((m) => [m.version, m]))
  const appliedDesc = [...applied].sort((a, b) => b.version.localeCompare(a.version))

  if (!to) {
    return appliedDesc.length > 0 ? [localByVersion.get(appliedDesc[0].version)!] : []
  }

  if (!applied.some((m) => m.version === to)) {
    throw new Error(`--to ${to} does not match any applied migration`)
  }

  return appliedDesc
    .filter((m) => m.version > to)
    .map((m) => localByVersion.get(m.version)!)
}

export async function runDown(options: DownOptions): Promise<void> {
  const config = loadConfig({ configPath: options.configPath })
  const { client, local, applied, divergence } = await buildSingleTargetReport(
    config,
    options.stage,
    options.db,
  )
  assertNoDivergence(divergence)

  const toRollback = selectToRollback(local, applied, options.to)

  if (toRollback.length === 0) {
    logger.info('No migrations to rollback.')
    return
  }

  let totalMs = 0
  let rolledBack = 0

  for (const migration of toRollback) {
    logger.info(`Rolling back ${migration.version}...`)
    const start = Date.now()
    try {
      await client.query(migration.down)
    } catch (err) {
      logger.printError(err)
      process.exitCode = 1
      logger.fail(`Rolled back ${rolledBack} migration(s) in ${totalMs}ms before failing.`)
      return
    }
    await recordRolledBack(client, migration.version)
    totalMs += Date.now() - start
    rolledBack += 1
  }

  logger.success(`Rolled back ${rolledBack} migrations in ${totalMs}ms total`)
}
