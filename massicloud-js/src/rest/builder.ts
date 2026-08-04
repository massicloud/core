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

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

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

  constructor(private ctx: BuilderContext) {}

  // ─── Verb starters ────────────────────────────────────────────────────────

  select(cols = '*'): this {
    this.method = 'GET'
    this.selectCols = cols
    return this
  }

  insert(values: Partial<T> | Partial<T>[]): this {
    this.method = 'POST'
    this.body = values
    this.preferReturn = true
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

      if (res.status === 204) return { data: null, error: null }

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
        return { data: json[0] as T, error: null }
      }

      if (this.maybeSingleRow) {
        if (!Array.isArray(json)) return { data: json as T, error: null }
        if (json.length === 0) return { data: null, error: null }
        if (json.length === 1) return { data: json[0] as T, error: null }
        return {
          data: null,
          error: new MassiCloudError(`expected 0 or 1 rows, got ${json.length}`, { status: 406 }),
        }
      }

      return { data: json as T, error: null }
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

    if (this.method === 'GET' && this.selectCols !== '*') {
      url.searchParams.set('select', this.selectCols)
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

    if (this.method !== 'GET' && this.method !== 'DELETE') {
      headers['Content-Type'] = 'application/json'
    }

    if (this.preferReturn) {
      headers['Prefer'] = 'return=representation'
    }

    if (this.rangeVal) {
      headers['Range'] = `${this.rangeVal[0]}-${this.rangeVal[1]}`
    }

    return headers
  }
}
