import { MassiCloudError } from '../errors'
import type { MassiResponse } from '../types'

interface StorageOptions {
  url: string // project base URL, e.g. https://api.massicloud.dz/v1/my-project
  key: string
  fetcher: typeof fetch
  getAccessToken: () => Promise<string | null>
}

export interface StorageObject {
  key: string
  size: number
  content_type: string
  last_modified: string
  etag: string
  url?: string
}

export interface ListObjectsResult {
  objects: StorageObject[]
  folders: string[]
  prefix: string
  continuation_token?: string
  is_truncated: boolean
}

export interface SignedUrlResponse {
  url: string
  expires_at: string
  method: string
}

// chi's wildcard route needs literal "/" between path segments, so encode
// each segment on its own rather than escaping the whole key.
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

async function parseJSON<T>(res: Response): Promise<MassiResponse<T>> {
  if (res.status === 204) return { data: null, error: null }

  const text = await res.text()
  let json: unknown = null
  if (text) {
    try { json = JSON.parse(text) } catch { json = text }
  }

  if (!res.ok) {
    const errBody = json as Record<string, unknown> | null
    const message = String(
      (errBody && errBody.error) ?? (errBody && errBody.message) ?? `request failed: ${res.status}`,
    )
    return { data: null, error: new MassiCloudError(message, { status: res.status, details: json }) }
  }

  return { data: json as T, error: null }
}

export class StorageClient {
  constructor(private opts: StorageOptions) {}

  /** Scope subsequent calls to a bucket, mirroring `.from(table)` on the REST client. */
  from(bucket: string): StorageBucketApi {
    return new StorageBucketApi(bucket, this.opts)
  }
}

export class StorageBucketApi {
  constructor(private bucket: string, private opts: StorageOptions) {}

  private get baseURL(): string {
    return `${this.opts.url}/storage/buckets/${this.bucket}`
  }

  private async headers(json = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'X-MassiCloud-Key': this.opts.key,
    }
    const token = await this.opts.getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (json) headers['Content-Type'] = 'application/json'
    return headers
  }

  /** List objects (and "folders" by common prefix) under an optional prefix. */
  async list(prefix = '', opts: { limit?: number } = {}): Promise<MassiResponse<ListObjectsResult>> {
    try {
      const url = new URL(`${this.baseURL}/objects`)
      if (prefix) url.searchParams.set('prefix', prefix)
      if (opts.limit) url.searchParams.set('max_keys', String(opts.limit))

      const res = await this.opts.fetcher(url.toString(), { headers: await this.headers() })
      return await parseJSON<ListObjectsResult>(res)
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  /** Upload a file. Requires a signed-in end user — anonymous writes are never allowed. */
  async upload(key: string, file: Blob, opts: { contentType?: string } = {}): Promise<MassiResponse<StorageObject>> {
    try {
      const form = new FormData()
      const filename = key.split('/').pop() || key
      form.append('file', opts.contentType ? new Blob([file], { type: opts.contentType }) : file, filename)
      form.append('key', key)

      const res = await this.opts.fetcher(`${this.baseURL}/objects`, {
        method: 'POST',
        headers: await this.headers(),
        body: form,
      })
      return await parseJSON<StorageObject>(res)
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  /** Download an object's bytes. Private buckets require a signed-in end user. */
  async download(key: string): Promise<MassiResponse<Blob>> {
    try {
      const res = await this.opts.fetcher(`${this.baseURL}/objects/${encodeKey(key)}`, {
        headers: await this.headers(),
      })

      if (!res.ok) {
        const text = await res.text()
        let json: unknown = null
        try { json = JSON.parse(text) } catch { json = text }
        const errBody = json as Record<string, unknown> | null
        const message = String((errBody && errBody.error) ?? `request failed: ${res.status}`)
        return { data: null, error: new MassiCloudError(message, { status: res.status, details: json }) }
      }

      return { data: await res.blob(), error: null }
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  /** Remove an object. Requires a signed-in end user. */
  async remove(key: string): Promise<MassiResponse<null>> {
    try {
      const res = await this.opts.fetcher(`${this.baseURL}/objects/${encodeKey(key)}`, {
        method: 'DELETE',
        headers: await this.headers(),
      })
      return await parseJSON<null>(res)
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  /**
   * Create a time-limited, credential-free URL for an object — safe to share
   * or hotlink, since it never carries MinIO credentials, only a single-use
   * download token. Works for objects in private buckets too, as long as the
   * caller currently has read access.
   */
  async createSignedUrl(key: string, expiresInSeconds = 3600): Promise<MassiResponse<SignedUrlResponse>> {
    try {
      const res = await this.opts.fetcher(`${this.baseURL}/presign`, {
        method: 'POST',
        headers: await this.headers(true),
        body: JSON.stringify({ key, expires_in_seconds: expiresInSeconds }),
      })
      return await parseJSON<SignedUrlResponse>(res)
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }
}
