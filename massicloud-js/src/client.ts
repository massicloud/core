import { AuthClient } from './auth'
import { RESTClient } from './rest'
import { StorageClient } from './storage'
import type { MassiCloudConfig } from './types'

const DEFAULT_DB = 'main'

export class MassiCloudClient {
  readonly auth: AuthClient
  readonly rest: RESTClient
  readonly storage: StorageClient

  private readonly dbBaseURL: string
  private readonly _config: {
    url: string
    key: string
    stage: string
    db: string
    fetcher: typeof fetch
    authConfig: MassiCloudConfig['auth']
  }

  constructor(config: MassiCloudConfig) {
    if (!config.url)   throw new Error('MassiCloud: url is required')
    if (!config.key)   throw new Error('MassiCloud: key is required')
    if (!config.stage) throw new Error('MassiCloud: stage is required (e.g. "production")')

    const cleanUrl = config.url.replace(/\/$/, '')
    const db = config.db ?? DEFAULT_DB

    // Full URL to the db endpoint, e.g.:
    //   https://api.massicloud.dz/v1/my-project/production/db/main
    this.dbBaseURL = `${cleanUrl}/${config.stage}/db/${db}`

    const fetcher =
      config.fetch ??
      (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined)

    if (!fetcher) {
      throw new Error(
        'MassiCloud: no fetch implementation found. Pass `fetch` in config for Node < 18.',
      )
    }

    this._config = {
      url: cleanUrl,
      key: config.key,
      stage: config.stage,
      db,
      fetcher,
      authConfig: config.auth,
    }

    // Auth endpoints target THIS db (each db has its own auth.users table).
    // The storage key is stage-scoped so all sub-clients for the same stage
    // share the same session — signing in via massi.db('analytics').auth
    // makes the session available on massi.auth too.
    const authStorageKey =
      config.auth?.storageKey ?? `massicloud.${config.stage}.auth.token`

    this.auth = new AuthClient({
      url: this.dbBaseURL,
      key: config.key,
      fetch: fetcher,
      config: {
        ...(config.auth ?? {}),
        storageKey: authStorageKey,
      },
    })

    this.rest = new RESTClient({
      url: this.dbBaseURL,
      key: config.key,
      fetcher,
      getAccessToken: () => this.auth.getAccessToken(),
    })

    // Storage is project-scoped, not db-scoped — buckets aren't tied to a
    // specific database — so it's built from the clean project URL rather
    // than dbBaseURL.
    this.storage = new StorageClient({
      url: this._config.url,
      key: config.key,
      fetcher,
      getAccessToken: () => this.auth.getAccessToken(),
    })
  }

  /**
   * Return a new client scoped to a different database within the same stage.
   *
   * Auth state (session token) is shared: all sub-clients derived from the
   * same root client use the same stage-scoped storage key, so a sign-in on
   * one is immediately visible on all others.
   *
   * @example
   * const analytics = massi.db('analytics')
   * await analytics.from('events').select()
   */
  db(name: string): MassiCloudClient {
    if (name === this._config.db) return this

    return new MassiCloudClient({
      url: this._config.url,
      key: this._config.key,
      stage: this._config.stage,
      db: name,
      fetch: this._config.fetcher,
      // Propagate auth config so the sub-client uses the same storageKey.
      auth: this._config.authConfig,
    })
  }

  /** Shortcut: client.from(table) === client.rest.from(table) */
  from<T = unknown>(table: string) {
    return this.rest.from<T>(table)
  }
}

export function createClient(config: MassiCloudConfig): MassiCloudClient {
  return new MassiCloudClient(config)
}
