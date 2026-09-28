import type { ResolvedTarget } from './config'
import { ApiError, AuthError, NotFoundError, SqlError } from './errors'
import * as logger from './logger'
import { sleep } from './sleep'

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 2000

/**
 * The /query endpoint's success shape. Rows are positional arrays aligned
 * with `columns` (like a raw Postgres result set), NOT objects keyed by
 * column name — `columns`/`rows` are only present for statements that
 * return a result set (e.g. SELECT); DDL/DML responses may omit them.
 */
export interface QueryResponse {
  command?: string
  rowCount?: number
  columns?: string[]
  rows?: unknown[][]
  took_ms?: number
  [key: string]: unknown
}

interface SqlErrorBody {
  error: string
  code?: string
  detail?: string
  hint?: string
  position?: string | number
}

export type Fetcher = typeof fetch

export class MassiCloudApiClient {
  private readonly queryUrl: string

  constructor(
    private readonly config: ResolvedTarget,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.queryUrl = `${config.url}/${config.stage}/db/${config.db}/query`
  }

  async query(sql: string): Promise<QueryResponse> {
    let delayMs = INITIAL_RETRY_DELAY_MS

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response
      try {
        response = await this.fetcher(this.queryUrl, {
          method: 'POST',
          headers: {
            'X-MassiCloud-Key': this.config.service_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        })
      } catch (err) {
        throw new ApiError(
          `Request to ${this.queryUrl} failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const attemptNum = attempt + 2
        logger.warn(
          `Rate limited, retrying in ${delayMs / 1000}s (attempt ${attemptNum}/${MAX_RETRIES + 1})...`,
        )
        await sleep(delayMs)
        delayMs *= 2
        continue
      }

      if (response.status === 200) {
        return (await response.json()) as QueryResponse
      }

      const body = await safeJson(response)

      if (response.status === 400) {
        const err = body as SqlErrorBody
        throw new SqlError(err.error ?? 'SQL error', err.code, err.detail, err.hint, err.position)
      }
      if (response.status === 403) {
        throw new AuthError((body as { error?: string })?.error ?? 'Forbidden', 403)
      }
      if (response.status === 404) {
        throw new NotFoundError((body as { error?: string })?.error ?? 'Not found', 404)
      }

      throw new ApiError(
        `Unexpected response from server (${response.status}): ${JSON.stringify(body)}`,
        response.status,
      )
    }

    throw new ApiError('Rate limited: max retries exceeded', 429)
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
