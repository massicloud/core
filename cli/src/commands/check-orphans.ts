import { loadConfig, resolveDbNames } from '../lib/config'
import * as logger from '../lib/logger'
import { buildOrphanReport } from '../lib/report'

export interface CheckOrphansOptions {
  configPath: string
  db?: string
}

export async function runCheckOrphans(options: CheckOrphansOptions): Promise<void> {
  const config = loadConfig({ configPath: options.configPath })
  const dbs = resolveDbNames(config, options.db)

  for (const db of dbs) {
    if (dbs.length > 1) logger.info(`=== Database: ${db} ===`)

    const report = await buildOrphanReport(config, db)

    logger.info('Safe to delete (not applied anywhere):')
    if (report.safeToDelete.length === 0) {
      logger.info('  (none)')
    } else {
      for (const migration of report.safeToDelete) {
        logger.info(`  - ${migration.filename}`)
      }
    }

    logger.info('')
    logger.info('In use (applied in at least one stage):')
    if (report.inUse.length === 0) {
      logger.info('  (none)')
    } else {
      for (const { migration, stages } of report.inUse) {
        logger.info(`  - ${migration.filename} (${stages.join(', ')})`)
      }
    }

    if (dbs.length > 1) logger.info('')
  }
}
