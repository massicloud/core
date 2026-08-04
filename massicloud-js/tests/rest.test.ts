import { describe, it, expect } from 'vitest'
import { createClient } from '../src'
import type { MassiCloudConfig } from '../src'

function captureClient(onRequest: (url: string, init?: RequestInit) => void, responseBody: unknown = [], status = 200) {
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

describe('REST base URL', () => {
  it('routes requests to /{stage}/db/{db}/rest/{table}', async () => {
    let captured = ''
    const client = captureClient((url) => { captured = url })
    await client.from('todos').select('*')
    expect(captured).toContain('/production/db/main/rest/todos')
  })

  it('strips trailing slash from base url', async () => {
    let captured = ''
    const client = createClient({
      url: 'https://api.example.com/v1/proj/',
      key: 'k',
      stage: 'staging',
      db: 'prod',
      fetch: async (input) => {
        captured = typeof input === 'string' ? input : (input as Request).url
        return new Response('[]', { status: 200 })
      },
      auth: { persistSession: false },
    })
    await client.from('posts').select('*')
    // path should not have double slashes (protocol // is fine)
    expect(captured.replace(/^https?:\/\//, '')).not.toContain('//')
    expect(captured).toContain('/staging/db/prod/rest/posts')
  })
})

describe('REST select', () => {
  it('returns array data on success', async () => {
    const client = captureClient(() => {}, [{ id: 1, title: 'hi' }, { id: 2, title: 'bye' }])
    const { data, error } = await client.from('todos').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: 1, title: 'hi' }, { id: 2, title: 'bye' }])
  })

  it('sends X-MassiCloud-Key header', async () => {
    let headers: Record<string, string> = {}
    const client = captureClient((_, init) => {
      headers = Object.fromEntries(
        Object.entries(init?.headers ?? {}) as [string, string][]
      )
    })
    await client.from('todos').select('*')
    expect(headers['X-MassiCloud-Key']).toBe('mc_anon_test')
  })

  it('does not send Authorization when not signed in', async () => {
    let headers: HeadersInit | undefined
    const client = captureClient((_, init) => { headers = init?.headers })
    await client.from('todos').select('*')
    const h = headers as Record<string, string>
    expect(h['Authorization']).toBeUndefined()
  })
})

describe('REST filters in URL', () => {
  it('applies eq filter', async () => {
    let url = ''
    const client = captureClient((u) => { url = u })
    await client.from('todos').select('*').eq('user_id', 'u1')
    expect(url).toContain('user_id=eq.u1')
  })

  it('applies multiple filters', async () => {
    let url = ''
    const client = captureClient((u) => { url = u })
    await client.from('todos').select('*').eq('published', true).gte('views', 100)
    expect(url).toContain('published=eq.true')
    expect(url).toContain('views=gte.100')
  })

  it('applies order + limit + offset', async () => {
    let url = ''
    const client = captureClient((u) => { url = u })
    await client.from('posts').select('*').order('created_at', { ascending: false }).limit(10).offset(20)
    expect(url).toContain('order=created_at.desc')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=20')
  })

  it('applies in filter', async () => {
    let url = ''
    const client = captureClient((u) => { url = u })
    await client.from('posts').select('*').in('status', ['draft', 'published'])
    expect(url).toContain('status=in.')
    expect(url).toContain('draft')
    expect(url).toContain('published')
  })
})

describe('REST .single()', () => {
  it('unwraps single-element array', async () => {
    const client = captureClient(() => {}, [{ id: 1 }])
    const { data, error } = await client.from('todos').select('*').eq('id', 1).single()
    expect(error).toBeNull()
    expect(data).toEqual({ id: 1 })
  })

  it('errors if array has 0 rows', async () => {
    const client = captureClient(() => {}, [])
    const { data, error } = await client.from('todos').select('*').eq('id', 999).single()
    expect(data).toBeNull()
    expect(error?.status).toBe(406)
    expect(error?.message).toContain('0')
  })

  it('errors if array has 2+ rows', async () => {
    const client = captureClient(() => {}, [{ id: 1 }, { id: 2 }])
    const { data, error } = await client.from('todos').select('*').single()
    expect(data).toBeNull()
    expect(error?.status).toBe(406)
  })
})

describe('REST .maybeSingle()', () => {
  it('returns null when no rows', async () => {
    const client = captureClient(() => {}, [])
    const { data, error } = await client.from('todos').select('*').eq('id', 0).maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('returns row when exactly one', async () => {
    const client = captureClient(() => {}, [{ id: 5 }])
    const { data } = await client.from('todos').select('*').maybeSingle()
    expect(data).toEqual({ id: 5 })
  })
})

describe('REST insert', () => {
  it('sends POST with JSON body and Prefer header', async () => {
    let method = '', body = '', headers: Record<string, string> = {}
    const client = captureClient((_, init) => {
      method = init?.method ?? ''
      body = init?.body as string
      headers = Object.fromEntries(
        Object.entries(init?.headers ?? {}) as [string, string][]
      )
    }, [{ id: 1, title: 'new' }])

    await client.from('todos').insert({ title: 'new' })
    expect(method).toBe('POST')
    expect(JSON.parse(body)).toEqual({ title: 'new' })
    expect(headers['Prefer']).toBe('return=representation')
    expect(headers['Content-Type']).toBe('application/json')
  })
})

describe('REST update', () => {
  it('sends PATCH with JSON body', async () => {
    let method = '', body = ''
    const client = captureClient((_, init) => {
      method = init?.method ?? ''
      body = init?.body as string
    })
    await client.from('todos').update({ title: 'updated' }).eq('id', 1)
    expect(method).toBe('PATCH')
    expect(JSON.parse(body)).toEqual({ title: 'updated' })
  })
})

describe('REST delete', () => {
  it('sends DELETE', async () => {
    let method = ''
    const client = captureClient((_, init) => { method = init?.method ?? '' })
    await client.from('todos').delete().eq('id', 1)
    expect(method).toBe('DELETE')
  })
})

describe('REST error handling', () => {
  it('wraps HTTP errors in MassiCloudError', async () => {
    const client = captureClient(() => {}, { message: 'permission denied' }, 403)
    const { data, error } = await client.from('secret').select('*')
    expect(data).toBeNull()
    expect(error?.status).toBe(403)
    expect(error?.message).toContain('permission denied')
  })

  it('returns { data: null, error: null } on 204 no content', async () => {
    const fetcher: typeof fetch = async () => new Response(null, { status: 204 })
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'production',
      fetch: fetcher,
      auth: { persistSession: false },
    })
    const { data, error } = await client.from('todos').delete().eq('id', 1)
    expect(data).toBeNull()
    expect(error).toBeNull()
  })
})

describe('client.from() shortcut', () => {
  it('is equivalent to client.rest.from()', async () => {
    let url1 = '', url2 = ''
    const makeClient = (capture: (u: string) => void) =>
      createClient({
        url: 'https://api.example.com/v1/proj',
        key: 'k',
        stage: 'production',
        fetch: async (input) => {
          capture(typeof input === 'string' ? input : (input as Request).url)
          return new Response('[]', { status: 200 })
        },
        auth: { persistSession: false },
      })

    const c1 = makeClient((u) => { url1 = u })
    const c2 = makeClient((u) => { url2 = u })

    await c1.from('posts').select('*')
    await c2.rest.from('posts').select('*')

    expect(url1).toBe(url2)
  })
})

describe('multi-db (.db())', () => {
  it('switches db with .db()', async () => {
    let lastURL = ''
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'mc_anon_test',
      stage: 'production',
      fetch: async (input: any) => {
        lastURL = typeof input === 'string' ? input : input.url
        return new Response('[]', { status: 200 })
      },
      auth: { persistSession: false },
    })

    await client.from('foo').select()
    expect(lastURL).toContain('/production/db/main/rest/foo')

    await client.db('analytics').from('events').select()
    expect(lastURL).toContain('/production/db/analytics/rest/events')
  })

  it('returns the same instance when calling .db() with the current db', () => {
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'mc_anon_test',
      stage: 'production',
      db: 'main',
      auth: { persistSession: false },
    })
    expect(client.db('main')).toBe(client)
  })

  it('sub-client targets the correct REST URL', async () => {
    let captured = ''
    const client = createClient({
      url: 'https://api.example.com/v1/proj',
      key: 'k',
      stage: 'staging',
      fetch: async (input: any) => {
        captured = typeof input === 'string' ? input : input.url
        return new Response('[]', { status: 200 })
      },
      auth: { persistSession: false },
    })
    await client.db('warehouse').from('sales').select()
    expect(captured).toContain('/staging/db/warehouse/rest/sales')
  })
})
