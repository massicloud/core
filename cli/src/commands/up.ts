import { loadConfig } from '../lib/config'
import * as logger from '../lib/logger'
import { assertNoDivergence, type ParsedMigration } from '../lib/migrations'
import { buildSingleTargetReport } from '../lib/report'
import { sleep } from '../lib/sleep'
import { recordApplied } from '../lib/state'

const INTER_MIGRATION_DELAY_MS = 500

export interface UpOptions {
  configPath: string
  stage?: string
  db?: string
  to?: string
}

function selectPending(pending: ParsedMigration[], to: string | undefined): ParsedMigration[] {
  if (!to) return pending
  const index = pending.findIndex((m) => m.version === to)
  if (index === -1) {
    throw new Error(`--to ${to} does not match any pending migration`)
  }
  return pending.slice(0, index + 1)
}

export async function runUp(options: UpOptions): Promise<void> {
  const config = loadConfig({ configPath: options.configPath })
  const { client, divergence } = await buildSingleTargetReport(config, options.stage, options.db)
  assertNoDivergence(divergence)

  const toApply = selectPending(divergence.pending, options.to)

  if (toApply.length === 0) {
    logger.info('No pending migrations.')
    return
  }

  let totalMs = 0
  let applied = 0

  for (const [idx, migration] of toApply.entries()) {
    logger.info(`Applying ${migration.version}...`)
    const start = Date.now()
    try {
      await client.query(migration.up)
    } catch (err) {
      logger.printError(err)
      process.exitCode = 1
      logger.fail(`Applied ${applied} migration(s) in ${totalMs}ms before failing.`)
      return
    }
    const elapsed = Date.now() - start
    await recordApplied(client, {
      version: migration.version,
      name: migration.name,
      checksum: migration.checksum,
      executionTimeMs: elapsed,
    })
    totalMs += elapsed
    applied += 1

    if (idx < toApply.length - 1) {
      await sleep(INTER_MIGRATION_DELAY_MS)
    }
  }

  logger.success(`Applied ${applied} migrations in ${totalMs}ms total`)
}
