import { describe, it, expect } from 'vitest'
import { createClient } from '../src'

function captureClient(onRequest: (url: string, init?: RequestInit) => void, responseBody: unknown = {}, status = 200) {
  const fetcher: typeof fetch = async (input, init?) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    onRequest(url, init)
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return createClient({
    url: 'https://api.example.com/v1/proj',
    key: 'mc_anon_test',
    stage: 'production',
    fetch: fetcher,
    auth: { persistSession: false },
  })
}

describe('storage base URL', () => {
  it('is project-scoped, not stage/db-scoped', async () => {
    let captured = ''
    const client = captureClient((url) => { captured = url })
    await client.storage.from('avatars').list()
    expect(captured).toContain('/v1/proj/storage/buckets/avatars/objects')
    expect(captured).not.toContain('/production/db/')
  })

  it('sends X-MassiCloud-Key header', async () => {
    let headers: Record<string, string> = {}
    const client = captureClient((_, init) => {
      headers = Object.fromEntries(Object.entries(init?.headers ?? {}) as [string, string][])
    })
    await client.storage.from('avatars').list()
    expect(headers['X-MassiCloud-Key']).toBe('mc_anon_test')
  })
})

describe('storage.list', () => {
  it('passes prefix and max_keys as query params', async () => {
    let url = ''
    const client = captureClient((u) => { url = u }, { objects: [], folders: [], prefix: '', is_truncated: false })
    await client.storage.from('avatars').list('users/', { limit: 50 })
    expect(url).toContain('prefix=users%2F')
    expect(url).toContain('max_keys=50')
  })

  it('returns the parsed result', async () => {
    const result = { objects: [{ key: 'a.txt', size: 1, content_type: 'text/plain', last_modified: 'now', etag: 'x' }], folders: [], prefix: '', is_truncated: false }
    const client = captureClient(() => {}, result)
    const { data, error } = await client.storage.from('avatars').list()
    expect(error).toBeNull()
    expect(data).toEqual(result)
  })
})

describe('storage.upload', () => {
  it('sends a multipart POST with the key field set', async () => {
    let method = '', body: FormData | undefined
    const client = captureClient((_, init) => {
      method = init?.method ?? ''
      body = init?.body as FormData
    }, { key: 'users/42/photo.txt', size: 5, content_type: 'text/plain', last_modified: 'now', etag: 'x' }, 201)

    const file = new Blob(['hello'], { type: 'text/plain' })
    await client.storage.from('avatars').upload('users/42/photo.txt', file)

    expect(method).toBe('POST')
    expect(body?.get('key')).toBe('users/42/photo.txt')
    expect(body?.get('file')).toBeInstanceOf(Blob)
  })
})

describe('storage.download', () => {
  it('encodes path segments but keeps slashes literal', async () => {
    let url = ''
    const fetcher: typeof fetch = async (input) => {
      url = typeof input === 'string' ? input : (input as Request).url
      return new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'production',
      fetch: fetcher,
      auth: { persistSession: false },
    })
    await client.storage.from('avatars').download('users/42/my photo.txt')
    expect(url).toContain('/objects/users/42/my%20photo.txt')
  })

  it('returns a Blob on success', async () => {
    const fetcher: typeof fetch = async () => new Response('hello', { status: 200 })
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'production',
      fetch: fetcher,
      auth: { persistSession: false },
    })
    const { data, error } = await client.storage.from('avatars').download('a.txt')
    expect(error).toBeNull()
    expect(data).toBeInstanceOf(Blob)
  })

  it('wraps errors from a non-ok response', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: 'object not found' }), { status: 404 })
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'production',
      fetch: fetcher,
      auth: { persistSession: false },
    })
    const { data, error } = await client.storage.from('avatars').download('missing.txt')
    expect(data).toBeNull()
    expect(error?.status).toBe(404)
    expect(error?.message).toContain('object not found')
  })
})

describe('storage.remove', () => {
  it('sends DELETE to the object path', async () => {
    let method = '', url = ''
    const fetcher: typeof fetch = async (input, init) => {
      url = typeof input === 'string' ? input : (input as Request).url
      method = init?.method ?? ''
      return new Response(null, { status: 204 })
    }
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'production',
      fetch: fetcher,
      auth: { persistSession: false },
    })
    const { error } = await client.storage.from('avatars').remove('a.txt')
    expect(method).toBe('DELETE')
    expect(url).toContain('/objects/a.txt')
    expect(error).toBeNull()
  })
})

describe('storage.createSignedUrl', () => {
  it('posts key and expires_in_seconds as JSON', async () => {
    let body = '', headers: Record<string, string> = {}
    const client = captureClient((_, init) => {
      body = init?.body as string
      headers = Object.fromEntries(Object.entries(init?.headers ?? {}) as [string, string][])
    }, { url: 'https://api.example.com/storage/download?token=abc', expires_at: 'later', method: 'GET' })

    await client.storage.from('avatars').createSignedUrl('a.txt', 120)

    expect(JSON.parse(body)).toEqual({ key: 'a.txt', expires_in_seconds: 120 })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('defaults to 3600 seconds', async () => {
    let body = ''
    const client = captureClient((_, init) => { body = init?.body as string }, { url: 'x', expires_at: 'later', method: 'GET' })
    await client.storage.from('avatars').createSignedUrl('a.txt')
    expect(JSON.parse(body).expires_in_seconds).toBe(3600)
  })
})
