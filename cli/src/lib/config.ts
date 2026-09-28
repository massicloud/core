import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ConfigError } from './errors'
import * as logger from './logger'

export interface DatabaseConfig {
  migrations_dir: string
}

export interface MassiCloudConfig {
  url: string
  service_key: string
  stages: string[]
  databases: Record<string, DatabaseConfig>
}

/** What a command actually needs to talk to one (stage, db) target. */
export interface ResolvedTarget {
  url: string
  service_key: string
  stage: string
  db: string
  migrations_dir: string
}

interface RawDatabaseConfig {
  migrations_dir?: string
}

/** Superset of the current and legacy (pre-multi-stage) config shapes. */
export interface RawConfigFile {
  url?: string
  service_key?: string
  stages?: string[]
  databases?: Record<string, RawDatabaseConfig>
  /** @deprecated legacy single-stage shape */
  stage?: string
  /** @deprecated legacy single-db shape */
  db?: string
  /** @deprecated legacy single-db shape */
  migrations_dir?: string
}

const DEFAULT_MIGRATIONS_DIR = './migrations'
const DEFAULT_CONFIG_PATH = './massicloud.config.json'

/**
 * Expands `${ENV_VAR}` references inside a string. Only used for
 * `service_key`, so users aren't forced to commit real keys to
 * massicloud.config.json.
 */
export function interpolateEnv(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
    const resolved = env[name]
    if (resolved === undefined) {
      throw new ConfigError(`Environment variable "${name}" referenced in config is not set`)
    }
    return resolved
  })
}

export function parseConfigFile(raw: string): RawConfigFile {
  try {
    return JSON.parse(raw) as RawConfigFile
  } catch (err) {
    throw new ConfigError(
      `Failed to parse config file as JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Adapts the pre-multi-stage config shape ({ stage, db, migrations_dir })
 * into { stages, databases }. Only called when the file has no "stages"/
 * "databases" of its own.
 */
function adaptLegacyShape(raw: RawConfigFile): { stages: string[]; databases: RawConfigFile['databases'] } {
  logger.warn(
    'massicloud.config.json uses the legacy single-stage/single-db shape ' +
      '("stage"/"db"/"migrations_dir"). Run "massicloud init" to migrate to ' +
      '"stages"/"databases", or update the file by hand — support for the ' +
      'legacy shape may be removed in a future version.',
  )

  if (!raw.stage) {
    throw new ConfigError('Legacy config is missing required field "stage"')
  }

  return {
    stages: [raw.stage],
    databases: {
      [raw.db ?? 'main']: { migrations_dir: raw.migrations_dir ?? DEFAULT_MIGRATIONS_DIR },
    },
  }
}

function isNewShape(raw: RawConfigFile): boolean {
  return Array.isArray(raw.stages) && raw.databases !== undefined && raw.databases !== null
}

function isLegacyShape(raw: RawConfigFile): boolean {
  return Boolean(raw.stage || raw.db || raw.migrations_dir)
}

export interface LoadConfigOptions {
  configPath?: string
  env?: NodeJS.ProcessEnv
  /** Injected for testing; defaults to node:fs readFileSync. */
  readFile?: (path: string) => string
}

export function loadConfig(options: LoadConfigOptions = {}): MassiCloudConfig {
  const env = options.env ?? process.env
  const configPath = resolve(options.configPath ?? DEFAULT_CONFIG_PATH)
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf8'))

  let raw: RawConfigFile = {}
  try {
    raw = parseConfigFile(readFile(configPath))
  } catch (err) {
    if (err instanceof ConfigError) throw err
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      throw new ConfigError(
        `Config file not found at ${configPath}. Run "massicloud init" to create one.`,
      )
    }
    throw new ConfigError(`Failed to read config file at ${configPath}: ${String(err)}`)
  }

  const url = env.MASSICLOUD_URL ?? raw.url
  const serviceKey = env.MASSICLOUD_SERVICE_KEY ?? raw.service_key

  if (!url) {
    throw new ConfigError(`Config is missing required field "url". Set it in ${configPath} or via MASSICLOUD_URL.`)
  }
  if (!serviceKey) {
    throw new ConfigError(
      `Config is missing required field "service_key". Set it in ${configPath} or via MASSICLOUD_SERVICE_KEY.`,
    )
  }

  let stages: string[] | undefined
  let databases: Record<string, RawDatabaseConfig> | undefined

  if (isNewShape(raw)) {
    stages = raw.stages
    databases = raw.databases
  } else if (isLegacyShape(raw)) {
    const adapted = adaptLegacyShape(raw)
    stages = adapted.stages
    databases = adapted.databases
  } else {
    throw new ConfigError(
      `Config at ${configPath} must define "stages" (array) and "databases" (object). ` +
        `Run "massicloud init" to generate one.`,
    )
  }

  if (!Array.isArray(stages) || stages.length === 0 || stages.some((s) => !s)) {
    throw new ConfigError('Config "stages" must be a non-empty array of non-empty strings')
  }
  if (!databases || typeof databases !== 'object' || Object.keys(databases).length === 0) {
    throw new ConfigError('Config "databases" must be a non-empty object')
  }

  const normalizedDatabases: Record<string, DatabaseConfig> = {}
  for (const [name, dbConfig] of Object.entries(databases)) {
    normalizedDatabases[name] = {
      migrations_dir: dbConfig?.migrations_dir ?? DEFAULT_MIGRATIONS_DIR,
    }
  }

  return {
    url: url.replace(/\/+$/, ''),
    service_key: interpolateEnv(serviceKey, env),
    stages,
    databases: normalizedDatabases,
  }
}

/**
 * Resolves a single db name: an explicit --db arg wins, then
 * MASSICLOUD_DB, then the sole configured database if there's exactly
 * one. Otherwise --db is required.
 */
export function resolveSingleDb(
  config: MassiCloudConfig,
  dbArg?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dbNames = Object.keys(config.databases)
  const db = dbArg ?? env.MASSICLOUD_DB ?? (dbNames.length === 1 ? dbNames[0] : undefined)

  if (!db) {
    throw new ConfigError(`--db is required. Configured databases: ${dbNames.join(', ')}`)
  }
  if (!config.databases[db]) {
    throw new ConfigError(`Unknown database "${db}". Configured databases: ${dbNames.join(', ')}`)
  }
  return db
}

/** Resolves and validates the (stage, db) pair a command should target. */
export function resolveTarget(
  config: MassiCloudConfig,
  stageArg?: string,
  dbArg?: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedTarget {
  const db = resolveSingleDb(config, dbArg, env)
  const stage = stageArg ?? env.MASSICLOUD_STAGE

  if (!stage) {
    throw new ConfigError(`--stage is required. Configured stages: ${config.stages.join(', ')}`)
  }
  if (!config.stages.includes(stage)) {
    throw new ConfigError(`Unknown stage "${stage}". Configured stages: ${config.stages.join(', ')}`)
  }

  return {
    url: config.url,
    service_key: config.service_key,
    stage,
    db,
    migrations_dir: config.databases[db].migrations_dir,
  }
}

/** Explicit --db selects one; omitted selects all configured databases. */
export function resolveDbNames(config: MassiCloudConfig, dbArg?: string): string[] {
  if (!dbArg) return Object.keys(config.databases)
  if (!config.databases[dbArg]) {
    throw new ConfigError(
      `Unknown database "${dbArg}". Configured databases: ${Object.keys(config.databases).join(', ')}`,
    )
  }
  return [dbArg]
}

/** Explicit --stage selects one; omitted selects all configured stages. */
export function resolveStageNames(config: MassiCloudConfig, stageArg?: string): string[] {
  if (!stageArg) return config.stages
  if (!config.stages.includes(stageArg)) {
    throw new ConfigError(`Unknown stage "${stageArg}". Configured stages: ${config.stages.join(', ')}`)
  }
  return [stageArg]
}
