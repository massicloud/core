import { resolve } from 'node:path'
import { MassiCloudApiClient } from './client'
import type { MassiCloudConfig } from './config'
import { resolveTarget, type ResolvedTarget } from './config'
import { NotFoundError } from './errors'
import {
  diffMigrations,
  loadMigrations,
  type AppliedMigration,
  type Divergence,
  type ParsedMigration,
} from './migrations'
import { ensureStateTable, fetchAppliedMigrations } from './state'

export interface SingleTargetReport {
  target: ResolvedTarget
  client: MassiCloudApiClient
  local: ParsedMigration[]
  applied: AppliedMigration[]
  divergence: Divergence
}

/** Loads config-resolved state for one (stage, db) pair — used by up/down/verify. */
export async function buildSingleTargetReport(
  config: MassiCloudConfig,
  stageArg: string | undefined,
  dbArg: string | undefined,
): Promise<SingleTargetReport> {
  const target = resolveTarget(config, stageArg, dbArg)
  const client = new MassiCloudApiClient(target)
  await ensureStateTable(client)

  const local = loadMigrations(resolve(target.migrations_dir))
  const applied = await fetchAppliedMigrations(client)
  const divergence = diffMigrations(local, applied)

  return { target, client, local, applied, divergence }
}

/**
 * A stage that 404s (no such stage provisioned for this project yet) is
 * represented as `null` rather than an empty Map, so callers can tell
 * "not provisioned" apart from "provisioned, nothing applied yet".
 */
async function fetchAppliedByStage(
  config: MassiCloudConfig,
  db: string,
  migrationsDir: string,
): Promise<Map<string, Map<string, AppliedMigration> | null>> {
  const appliedByStage = new Map<string, Map<string, AppliedMigration> | null>()

  for (const stage of config.stages) {
    const client = new MassiCloudApiClient({
      url: config.url,
      service_key: config.service_key,
      stage,
      db,
      migrations_dir: migrationsDir,
    })
    try {
      await ensureStateTable(client)
      const applied = await fetchAppliedMigrations(client)
      appliedByStage.set(stage, new Map(applied.map((m) => [m.version, m])))
    } catch (err) {
      if (err instanceof NotFoundError) {
        appliedByStage.set(stage, null)
        continue
      }
      throw err
    }
  }

  return appliedByStage
}

export type CellStatus = 'ok' | 'pending' | 'missing' | 'mismatch' | 'not_provisioned'

export interface StatusRow {
  version: string
  name: string
  cells: Record<string, CellStatus>
}

export interface DbStatusReport {
  db: string
  stages: string[]
  rows: StatusRow[]
  dirty: boolean
}

/**
 * Builds the status matrix for one database: one row per migration
 * version (local or applied-anywhere), one column per configured stage.
 */
export async function buildDbStatusReport(config: MassiCloudConfig, db: string): Promise<DbStatusReport> {
  const dbConfig = config.databases[db]
  const local = loadMigrations(resolve(dbConfig.migrations_dir))
  const localByVersion = new Map(local.map((m) => [m.version, m]))

  const appliedByStage = await fetchAppliedByStage(config, db, dbConfig.migrations_dir)

  const allVersions = new Set<string>(local.map((m) => m.version))
  for (const appliedForStage of appliedByStage.values()) {
    if (!appliedForStage) continue
    for (const version of appliedForStage.keys()) allVersions.add(version)
  }

  const rows: StatusRow[] = [...allVersions].sort().map((version) => {
    const localMigration = localByVersion.get(version)
    let name = localMigration?.name
    const cells: Record<string, CellStatus> = {}

    for (const stage of config.stages) {
      const appliedForStage = appliedByStage.get(stage)
      if (appliedForStage === null) {
        cells[stage] = 'not_provisioned'
        continue
      }
      const applied = appliedForStage?.get(version)
      if (!applied) {
        cells[stage] = 'pending'
        continue
      }
      name = name ?? applied.name
      if (!localMigration) cells[stage] = 'missing'
      else if (localMigration.checksum !== applied.checksum) cells[stage] = 'mismatch'
      else cells[stage] = 'ok'
    }

    return { version, name: name ?? '(unknown)', cells }
  })

  const dirty = rows.some((row) =>
    Object.values(row.cells).some((status) => status === 'missing' || status === 'mismatch'),
  )

  return { db, stages: config.stages, rows, dirty }
}

export interface OrphanReport {
  db: string
  safeToDelete: ParsedMigration[]
  inUse: Array<{ migration: ParsedMigration; stages: string[] }>
}

/** For each local migration file, which stages (if any) have it applied. */
export async function buildOrphanReport(config: MassiCloudConfig, db: string): Promise<OrphanReport> {
  const dbConfig = config.databases[db]
  const local = loadMigrations(resolve(dbConfig.migrations_dir))

  const appliedByStage = await fetchAppliedByStage(config, db, dbConfig.migrations_dir)

  const safeToDelete: ParsedMigration[] = []
  const inUse: Array<{ migration: ParsedMigration; stages: string[] }> = []

  for (const migration of local) {
    const stages = config.stages.filter((stage) => appliedByStage.get(stage)?.has(migration.version))
    if (stages.length === 0) safeToDelete.push(migration)
    else inUse.push({ migration, stages })
  }

  return { db, safeToDelete, inUse }
}
