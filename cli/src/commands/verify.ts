import { loadConfig, resolveDbNames, resolveStageNames } from '../lib/config'
import { NotFoundError } from '../lib/errors'
import * as logger from '../lib/logger'
import { buildSingleTargetReport } from '../lib/report'

export interface VerifyOptions {
  configPath: string
  stage?: string
  db?: string
}

export async function runVerify(options: VerifyOptions): Promise<void> {
  const config = loadConfig({ configPath: options.configPath })
  const stages = resolveStageNames(config, options.stage)
  const dbs = resolveDbNames(config, options.db)

  let dirty = false

  for (const db of dbs) {
    for (const stage of stages) {
      let divergence
      try {
        ;({ divergence } = await buildSingleTargetReport(config, stage, db))
      } catch (err) {
        if (err instanceof NotFoundError) {
          logger.warn(`[${stage}/${db}] NOT PROVISIONED — skipped`)
          continue
        }
        throw err
      }

      if (divergence.missingLocal.length === 0 && divergence.checksumMismatches.length === 0) {
        continue
      }

      dirty = true
      logger.fail(`[${stage}/${db}] divergence detected:`)
      for (const missing of divergence.missingLocal) {
        logger.fail(`  MISSING LOCAL: ${missing.version} (${missing.name})`)
      }
      for (const { local } of divergence.checksumMismatches) {
        logger.fail(`  CHECKSUM MISMATCH: ${local.version} (${local.name})`)
      }
    }
  }

  if (dirty) {
    process.exitCode = 1
    return
  }

  logger.success('No divergence between local migrations and server state.')
}
