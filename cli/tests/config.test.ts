import { describe, expect, it, vi } from 'vitest'
import { ConfigError } from '../src/lib/errors'
import {
  interpolateEnv,
  loadConfig,
  parseConfigFile,
  resolveDbNames,
  resolveSingleDb,
  resolveStageNames,
  resolveTarget,
  type MassiCloudConfig,
} from '../src/lib/config'

describe('parseConfigFile', () => {
  it('parses valid JSON', () => {
    expect(parseConfigFile('{"url": "https://x"}')).toEqual({ url: 'https://x' })
  })

  it('throws ConfigError on invalid JSON', () => {
    expect(() => parseConfigFile('{not json')).toThrow(ConfigError)
  })
})

describe('interpolateEnv', () => {
  it('substitutes ${VAR} with the environment value', () => {
    expect(interpolateEnv('mc_service_${KEY}', { KEY: 'abc123' })).toBe('mc_service_abc123')
  })

  it('leaves plain strings untouched', () => {
    expect(interpolateEnv('mc_service_abc123', {})).toBe('mc_service_abc123')
  })

  it('throws when the referenced env var is unset', () => {
    expect(() => interpolateEnv('${MISSING}', {})).toThrow(ConfigError)
  })
})

describe('loadConfig (multi-stage/multi-db shape)', () => {
  const validFile = JSON.stringify({
    url: 'https://api.massicloud.work/v1/acme',
    service_key: '${MC_KEY}',
    stages: ['development', 'staging', 'production'],
    databases: {
      main: { migrations_dir: './migrations' },
    },
  })

  it('loads and validates a config file, expanding service_key', () => {
    const config = loadConfig({
      configPath: 'massicloud.config.json',
      env: { MC_KEY: 'mc_service_real' },
      readFile: () => validFile,
    })
    expect(config).toEqual({
      url: 'https://api.massicloud.work/v1/acme',
      service_key: 'mc_service_real',
      stages: ['development', 'staging', 'production'],
      databases: {
        main: { migrations_dir: './migrations' },
      },
    })
  })

  it('supports multiple databases, each with its own migrations_dir', () => {
    const config = loadConfig({
      env: { MC_KEY: 'k' },
      readFile: () =>
        JSON.stringify({
          url: 'https://x',
          service_key: '${MC_KEY}',
          stages: ['production'],
          databases: {
            main: { migrations_dir: './migrations' },
            analytics: { migrations_dir: './migrations-analytics' },
          },
        }),
    })
    expect(Object.keys(config.databases)).toEqual(['main', 'analytics'])
    expect(config.databases.analytics.migrations_dir).toBe('./migrations-analytics')
  })

  it('strips trailing slashes from url', () => {
    const config = loadConfig({
      env: { MC_KEY: 'k' },
      readFile: () =>
        JSON.stringify({
          url: 'https://x/',
          service_key: '${MC_KEY}',
          stages: ['production'],
          databases: { main: {} },
        }),
    })
    expect(config.url).toBe('https://x')
  })

  it('defaults a database\'s migrations_dir to "./migrations" when omitted', () => {
    const config = loadConfig({
      env: { MC_KEY: 'k' },
      readFile: () =>
        JSON.stringify({
          url: 'https://x',
          service_key: '${MC_KEY}',
          stages: ['production'],
          databases: { main: {} },
        }),
    })
    expect(config.databases.main.migrations_dir).toBe('./migrations')
  })

  it('lets MASSICLOUD_URL/MASSICLOUD_SERVICE_KEY env vars override config file values', () => {
    const config = loadConfig({
      env: {
        MASSICLOUD_URL: 'https://override',
        MASSICLOUD_SERVICE_KEY: 'mc_service_env',
        MC_KEY: 'unused',
      },
      readFile: () => validFile,
    })
    expect(config.url).toBe('https://override')
    expect(config.service_key).toBe('mc_service_env')
  })

  it('throws ConfigError when url or service_key is missing', () => {
    expect(() =>
      loadConfig({
        env: {},
        readFile: () => JSON.stringify({ stages: ['production'], databases: { main: {} } }),
      }),
    ).toThrow(ConfigError)
  })

  it('throws ConfigError when stages is empty', () => {
    expect(() =>
      loadConfig({
        env: { MC_KEY: 'k' },
        readFile: () =>
          JSON.stringify({
            url: 'https://x',
            service_key: '${MC_KEY}',
            stages: [],
            databases: { main: {} },
          }),
      }),
    ).toThrow(ConfigError)
  })

  it('throws ConfigError when databases is empty', () => {
    expect(() =>
      loadConfig({
        env: { MC_KEY: 'k' },
        readFile: () =>
          JSON.stringify({
            url: 'https://x',
            service_key: '${MC_KEY}',
            stages: ['production'],
            databases: {},
          }),
      }),
    ).toThrow(ConfigError)
  })

  it('throws ConfigError when neither the new nor legacy shape is present', () => {
    expect(() =>
      loadConfig({
        env: { MC_KEY: 'k' },
        readFile: () => JSON.stringify({ url: 'https://x', service_key: '${MC_KEY}' }),
      }),
    ).toThrow(ConfigError)
  })

  it('throws a helpful ConfigError when the file does not exist', () => {
    expect(() =>
      loadConfig({
        env: {},
        readFile: () => {
          const err = new Error('not found') as NodeJS.ErrnoException
          err.code = 'ENOENT'
          throw err
        },
      }),
    ).toThrow(/Run "massicloud init"/)
  })
})

describe('loadConfig (legacy single-stage/single-db shape)', () => {
  it('adapts { stage, db, migrations_dir } into { stages, databases } and warns', () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const config = loadConfig({
      env: { MC_KEY: 'k' },
      readFile: () =>
        JSON.stringify({
          url: 'https://x',
          service_key: '${MC_KEY}',
          stage: 'production',
          db: 'main',
          migrations_dir: './migrations',
        }),
    })

    expect(config.stages).toEqual(['production'])
    expect(config.databases).toEqual({ main: { migrations_dir: './migrations' } })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('defaults legacy db to "main" and migrations_dir to "./migrations"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const config = loadConfig({
      env: { MC_KEY: 'k' },
      readFile: () => JSON.stringify({ url: 'https://x', service_key: '${MC_KEY}', stage: 'production' }),
    })

    expect(config.databases).toEqual({ main: { migrations_dir: './migrations' } })

    vi.restoreAllMocks()
  })

  it('throws ConfigError when legacy shape is missing "stage"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      loadConfig({
        env: { MC_KEY: 'k' },
        readFile: () =>
          JSON.stringify({ url: 'https://x', service_key: '${MC_KEY}', db: 'main' }),
      }),
    ).toThrow(ConfigError)

    vi.restoreAllMocks()
  })
})

describe('resolveSingleDb', () => {
  const config: MassiCloudConfig = {
    url: 'https://x',
    service_key: 'k',
    stages: ['development', 'production'],
    databases: { main: { migrations_dir: './migrations' } },
  }

  const multiDbConfig: MassiCloudConfig = {
    ...config,
    databases: {
      main: { migrations_dir: './migrations' },
      analytics: { migrations_dir: './migrations-analytics' },
    },
  }

  it('defaults to the sole configured database', () => {
    expect(resolveSingleDb(config, undefined, {})).toBe('main')
  })

  it('requires --db when multiple databases are configured', () => {
    expect(() => resolveSingleDb(multiDbConfig, undefined, {})).toThrow(ConfigError)
  })

  it('accepts an explicit --db', () => {
    expect(resolveSingleDb(multiDbConfig, 'analytics', {})).toBe('analytics')
  })

  it('falls back to MASSICLOUD_DB', () => {
    expect(resolveSingleDb(multiDbConfig, undefined, { MASSICLOUD_DB: 'analytics' })).toBe('analytics')
  })

  it('throws ConfigError for an unknown db', () => {
    expect(() => resolveSingleDb(config, 'nope', {})).toThrow(ConfigError)
  })
})

describe('resolveTarget', () => {
  const config: MassiCloudConfig = {
    url: 'https://x',
    service_key: 'k',
    stages: ['development', 'production'],
    databases: { main: { migrations_dir: './migrations' } },
  }

  it('resolves a full target from explicit --stage/--db', () => {
    expect(resolveTarget(config, 'production', 'main', {})).toEqual({
      url: 'https://x',
      service_key: 'k',
      stage: 'production',
      db: 'main',
      migrations_dir: './migrations',
    })
  })

  it('requires --stage even when there is only one database', () => {
    expect(() => resolveTarget(config, undefined, 'main', {})).toThrow(ConfigError)
  })

  it('falls back to MASSICLOUD_STAGE', () => {
    const target = resolveTarget(config, undefined, 'main', { MASSICLOUD_STAGE: 'development' })
    expect(target.stage).toBe('development')
  })

  it('throws ConfigError for a stage not in the configured list', () => {
    expect(() => resolveTarget(config, 'nope', 'main', {})).toThrow(ConfigError)
  })
})

describe('resolveDbNames / resolveStageNames', () => {
  const config: MassiCloudConfig = {
    url: 'https://x',
    service_key: 'k',
    stages: ['development', 'staging', 'production'],
    databases: {
      main: { migrations_dir: './migrations' },
      analytics: { migrations_dir: './migrations-analytics' },
    },
  }

  it('resolveDbNames returns all configured databases when omitted', () => {
    expect(resolveDbNames(config, undefined)).toEqual(['main', 'analytics'])
  })

  it('resolveDbNames returns just the requested database', () => {
    expect(resolveDbNames(config, 'analytics')).toEqual(['analytics'])
  })

  it('resolveDbNames throws ConfigError for an unknown database', () => {
    expect(() => resolveDbNames(config, 'nope')).toThrow(ConfigError)
  })

  it('resolveStageNames returns all configured stages when omitted', () => {
    expect(resolveStageNames(config, undefined)).toEqual(['development', 'staging', 'production'])
  })

  it('resolveStageNames returns just the requested stage', () => {
    expect(resolveStageNames(config, 'staging')).toEqual(['staging'])
  })

  it('resolveStageNames throws ConfigError for an unknown stage', () => {
    expect(() => resolveStageNames(config, 'nope')).toThrow(ConfigError)
  })
})
