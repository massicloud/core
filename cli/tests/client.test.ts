import { describe, expect, it, vi } from 'vitest'
import { MassiCloudApiClient } from '../src/lib/client'
import type { ResolvedTarget } from '../src/lib/config'
import { ApiError, AuthError, NotFoundError, SqlError } from '../src/lib/errors'

const config: ResolvedTarget = {
  url: 'https://api.massicloud.work/v1/acme',
  service_key: 'mc_service_test',
  stage: 'production',
  db: 'main',
  migrations_dir: './migrations',
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

describe('MassiCloudApiClient.query', () => {
  it('posts to the correct URL with the service key header', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { command: 'CREATE', rowCount: 0 }))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)

    await client.query('CREATE TABLE t (id INT);')

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.massicloud.work/v1/acme/production/db/main/query',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-MassiCloud-Key': 'mc_service_test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'CREATE TABLE t (id INT);' }),
      }),
    )
  })

  it('returns the parsed body on 200', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { command: 'SELECT', rowCount: 1 }))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)
    const result = await client.query('SELECT 1;')
    expect(result).toEqual({ command: 'SELECT', rowCount: 1 })
  })

  it('throws SqlError with pgcode/detail/hint on 400', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: 'syntax error at or near "CRAETE"',
        code: '42601',
        detail: 'detail here',
        hint: 'did you mean CREATE?',
        position: '1',
      }),
    )
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)

    let error: unknown
    try {
      await client.query('CRAETE TABLE t ();')
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(SqlError)
    const sqlError = error as SqlError
    expect(sqlError.code).toBe('42601')
    expect(sqlError.detail).toBe('detail here')
    expect(sqlError.hint).toBe('did you mean CREATE?')
  })

  it('throws AuthError on 403', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'invalid service key' }))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)
    await expect(client.query('SELECT 1;')).rejects.toBeInstanceOf(AuthError)
  })

  it('throws NotFoundError on 404', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'db not found' }))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)
    await expect(client.query('SELECT 1;')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('wraps network failures in ApiError', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)
    await expect(client.query('SELECT 1;')).rejects.toBeInstanceOf(ApiError)
  })

  it('retries on 429 with exponential backoff and succeeds once the server recovers', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(429, {}))
        .mockResolvedValueOnce(jsonResponse(429, {}))
        .mockResolvedValueOnce(jsonResponse(200, { command: 'SELECT', rowCount: 1 }))
      const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)

      const resultPromise = client.query('SELECT 1;')

      // First 429 -> waits 2s before retrying.
      await vi.advanceTimersByTimeAsync(2000)
      // Second 429 -> waits 4s before retrying.
      await vi.advanceTimersByTimeAsync(4000)

      const result = await resultPromise

      expect(result).toEqual({ command: 'SELECT', rowCount: 1 })
      expect(fetcher).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry on non-429 errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'boom' }))
    const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)

    await expect(client.query('SELECT 1;')).rejects.toBeInstanceOf(ApiError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('errors out after exhausting retries on repeated 429s', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn().mockResolvedValue(jsonResponse(429, {}))
      const client = new MassiCloudApiClient(config, fetcher as unknown as typeof fetch)

      const resultPromise = client.query('SELECT 1;')
      const assertion = expect(resultPromise).rejects.toBeInstanceOf(ApiError)

      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(8000)

      await assertion
      // 1 initial attempt + 3 retries = 4 fetch calls total.
      expect(fetcher).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })
})
