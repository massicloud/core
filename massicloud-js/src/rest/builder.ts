import { serializeFilter } from './filters'
import { MassiCloudError } from '../errors'
import type { Filter, FilterOperator } from './filters'
import type { MassiResponse } from '../types'

interface BuilderContext {
  url: string    // e.g. https://api.../v1/proj/db/prod/rest
  key: string
  table: string
  fetcher: typeof fetch
  getAccessToken: () => Promise<string | null>
}

type Method = 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'

export interface SelectOptions {
  /**
   * Ask PostgREST for a total row count (across all rows the current
   * filters match, ignoring limit/offset/range) via the Content-Range
   * response header. 'exact' does a full COUNT(*) — accurate but scans the
   * matched rows; 'planned'/'estimated' use the query planner's row
   * estimate instead — fast on large tables, approximate.
   */
  count?: 'exact' | 'planned' | 'estimated'
  /** Send HEAD instead of GET — use with `count` to get a total without
   * fetching any rows (e.g. a pager's "47 results" label). */
  head?: boolean
}

export interface UpsertOptions {
  /** Column (or comma-separated columns) with the unique/exclusion
   * constraint to resolve conflicts against. Defaults to the table's
   * primary key if omitted. */
  onConflict?: string
  /** Silently keep the existing row on conflict instead of merging the new
   * values into it. */
  ignoreDuplicates?: boolean
}

export class QueryBuilder<T = unknown> implements PromiseLike<MassiResponse<T>> {
  private filters: Filter[] = []
  private selectCols = '*'
  private orderBy?: { column: string; ascending: boolean }
  private limitVal?: number
  private offsetVal?: number
  private rangeVal?: [number, number]
  private singleRow = false
  private maybeSingleRow = false
  private method: Method = 'GET'
  private body?: unknown
  private preferReturn = false
  private conflictResolution?: 'merge-duplicates' | 'ignore-duplicates'
  private onConflictCol?: string
  private countMode?: 'exact' | 'planned' | 'estimated'

  constructor(private ctx: BuilderContext) {}

  // ─── Verb starters ────────────────────────────────────────────────────────

  select(cols = '*', options?: SelectOptions): this {
    this.method = options?.head ? 'HEAD' : 'GET'
    this.selectCols = cols
    if (options?.count) this.countMode = options.count
    return this
  }

  insert(values: Partial<T> | Partial<T>[]): this {
    this.method = 'POST'
    this.body = values
    this.preferReturn = true
    return this
  }

  /**
   * Insert values, or update the matching row(s) in place if they already
   * exist (per `options.onConflict`, or the table's primary key by
   * default). Maps to PostgREST's upsert convention: `POST` with
   * `Prefer: resolution=merge-duplicates` and `?on_conflict=col`.
   */
  upsert(values: Partial<T> | Partial<T>[], options?: UpsertOptions): this {
    this.method = 'POST'
    this.body = values
    this.preferReturn = true
    this.conflictResolution = options?.ignoreDuplicates ? 'ignore-duplicates' : 'merge-duplicates'
    if (options?.onConflict) this.onConflictCol = options.onConflict
    return this
  }

  update(values: Partial<T>): this {
    this.method = 'PATCH'
    this.body = values
    this.preferReturn = true
    return this
  }

  delete(): this {
    this.method = 'DELETE'
    this.preferReturn = true
    return this
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): this  { return this.filter(column, 'eq', value) }
  neq(column: string, value: unknown): this { return this.filter(column, 'neq', value) }
  gt(column: string, value: unknown): this  { return this.filter(column, 'gt', value) }
  gte(column: string, value: unknown): this { return this.filter(column, 'gte', value) }
  lt(column: string, value: unknown): this  { return this.filter(column, 'lt', value) }
  lte(column: string, value: unknown): this { return this.filter(column, 'lte', value) }

  like(column: string, pattern: string): this  { return this.filter(column, 'like', pattern) }
  ilike(column: string, pattern: string): this { return this.filter(column, 'ilike', pattern) }

  is(column: string, value: null | boolean): this { return this.filter(column, 'is', value) }
  in(column: string, values: unknown[]): this     { return this.filter(column, 'in', values) }

  filter(column: string, operator: FilterOperator, value: unknown): this {
    this.filters.push({ column, operator, value })
    return this
  }

  // ─── Modifiers ────────────────────────────────────────────────────────────

  order(column: string, opts: { ascending?: boolean } = {}): this {
    this.orderBy = { column, ascending: opts.ascending ?? true }
    return this
  }

  limit(n: number): this  { this.limitVal = n; return this }
  offset(n: number): this { this.offsetVal = n; return this }

  range(from: number, to: number): this {
    this.rangeVal = [from, to]
    return this
  }

  single(): this      { this.singleRow = true; return this }
  maybeSingle(): this { this.maybeSingleRow = true; return this }

  // ─── Thenable (await-able without explicit .then()) ───────────────────────

  then<TResult1 = MassiResponse<T>, TResult2 = never>(
    onFulfilled?: ((value: MassiResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled, onRejected)
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  private async execute(): Promise<MassiResponse<T>> {
    try {
      const url = this.buildURL()
      const headers = await this.buildHeaders()

      const init: RequestInit = { method: this.method, headers }
      if (this.body !== undefined) {
        init.body = JSON.stringify(this.body)
      }

      const res = await this.ctx.fetcher(url, init)
      const count = parseContentRangeCount(res.headers.get('content-range'))

      if (res.status === 204) return { data: null, error: null, count }

      const text = await res.text()
      let json: unknown = null
      if (text) {
        try { json = JSON.parse(text) } catch { json = text }
      }

      if (!res.ok) {
        const errBody = json as Record<string, unknown> | null
        const message = String(
          (errBody && errBody.message) ?? (errBody && errBody.error) ?? `request failed: ${res.status}`
        )
        return {
          data: null,
          error: new MassiCloudError(message, { status: res.status, details: json }),
        }
      }

      if (this.singleRow) {
        if (!Array.isArray(json) || json.length !== 1) {
          return {
            data: null,
            error: new MassiCloudError(
              `expected exactly one row, got ${Array.isArray(json) ? json.length : 'non-array'}`,
              { status: 406 },
            ),
          }
        }
        return { data: json[0] as T, error: null, count }
      }

      if (this.maybeSingleRow) {
        if (!Array.isArray(json)) return { data: json as T, error: null, count }
        if (json.length === 0) return { data: null, error: null, count }
        if (json.length === 1) return { data: json[0] as T, error: null, count }
        return {
          data: null,
          error: new MassiCloudError(`expected 0 or 1 rows, got ${json.length}`, { status: 406 }),
        }
      }

      return { data: json as T, error: null, count }
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  buildURL(): string {
    const url = new URL(`${this.ctx.url}/${this.ctx.table}`)

    for (const f of this.filters) {
      const [col, val] = serializeFilter(f)
      url.searchParams.append(col, val)
    }

    if ((this.method === 'GET' || this.method === 'HEAD') && this.selectCols !== '*') {
      url.searchParams.set('select', this.selectCols)
    }

    if (this.onConflictCol) {
      url.searchParams.set('on_conflict', this.onConflictCol)
    }

    if (this.orderBy) {
      url.searchParams.set(
        'order',
        `${this.orderBy.column}.${this.orderBy.ascending ? 'asc' : 'desc'}`,
      )
    }

    if (this.limitVal !== undefined) url.searchParams.set('limit', String(this.limitVal))
    if (this.offsetVal !== undefined) url.searchParams.set('offset', String(this.offsetVal))

    return url.toString()
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'X-MassiCloud-Key': this.ctx.key,
    }

    const token = await this.ctx.getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    if (this.method !== 'GET' && this.method !== 'DELETE' && this.method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
    }

    const prefer: string[] = []
    if (this.conflictResolution) prefer.push(`resolution=${this.conflictResolution}`)
    if (this.countMode) prefer.push(`count=${this.countMode}`)
    if (this.preferReturn) prefer.push('return=representation')
    if (prefer.length > 0) headers['Prefer'] = prefer.join(',')

    if (this.rangeVal) {
      headers['Range'] = `${this.rangeVal[0]}-${this.rangeVal[1]}`
    }

    return headers
  }
}

/** Content-Range looks like "0-19/47" or "*\/*" (total unknown). */
function parseContentRangeCount(header: string | null): number | null {
  if (!header) return null
  const total = header.split('/')[1]
  if (!total || total === '*') return null
  const n = Number(total)
  return Number.isNaN(n) ? null : n
}
