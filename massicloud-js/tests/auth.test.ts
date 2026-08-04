import { describe, it, expect } from 'vitest'
import { createClient } from '../src'
import type { MassiCloudConfig } from '../src'

// A JWT with exp = 9999999999 (year 2286) — always valid
const VALID_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ sub: 'u1', exp: 9999999999 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') +
  '.fakesig'

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => { status: number; body: unknown },
): typeof fetch {
  return async (input, init?) => {
    const { status, body } = handler(input, init)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function baseConfig(fetcher: typeof fetch): MassiCloudConfig {
  return {
    url: 'https://api.example.com/v1/proj',
    key: 'mc_anon_test',
    stage: 'production',
    fetch: fetcher,
    auth: { persistSession: false },
  }
}

const fakeSession = {
  user: { id: 'u1', email: 'a@b.dz', created_at: '2026-01-01T00:00:00Z' },
  access_token: VALID_TOKEN,
  refresh_token: 'rt_abc',
  expires_in: 3600,
  token_type: 'Bearer',
}

describe('auth.signUp()', () => {
  it('returns session on success', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 201, body: fakeSession }))),
    )
    const { data, error } = await client.auth.signUp({ email: 'a@b.dz', password: 'x' })
    expect(error).toBeNull()
    expect(data?.user.email).toBe('a@b.dz')
    expect(data?.access_token).toBe(VALID_TOKEN)
    expect(data?.refresh_token).toBe('rt_abc')
  })

  it('returns MassiCloudError on 409 conflict', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 409, body: { error: 'email already registered' } }))),
    )
    const { data, error } = await client.auth.signUp({ email: 'a@b.dz', password: 'x' })
    expect(data).toBeNull()
    expect(error?.status).toBe(409)
    expect(error?.message).toContain('email already registered')
  })

  it('emits SIGNED_IN event', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 201, body: fakeSession }))),
    )
    const events: string[] = []
    client.auth.onAuthStateChange((event) => events.push(event))
    await client.auth.signUp({ email: 'a@b.dz', password: 'x' })
    expect(events).toContain('SIGNED_IN')
  })
})

describe('auth.signIn()', () => {
  it('returns session on success', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 200, body: fakeSession }))),
    )
    const { data, error } = await client.auth.signIn({ email: 'a@b.dz', password: 'secret' })
    expect(error).toBeNull()
    expect(data?.user.id).toBe('u1')
  })

  it('returns error on 401 bad credentials', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 401, body: { error: 'invalid credentials' } }))),
    )
    const { data, error } = await client.auth.signIn({ email: 'a@b.dz', password: 'wrong' })
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
  })
})

describe('auth.signOut()', () => {
  it('clears the session and emits SIGNED_OUT', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 200, body: fakeSession }))),
    )
    await client.auth.signIn({ email: 'a@b.dz', password: 'x' })

    const events: string[] = []
    client.auth.onAuthStateChange((e) => events.push(e))

    const { error } = await client.auth.signOut()
    expect(error).toBeNull()

    const { data: session } = await client.auth.getSession()
    expect(session).toBeNull()
    expect(events).toContain('SIGNED_OUT')
  })
})

describe('auth.getSession()', () => {
  it('returns null before any sign-in', async () => {
    const client = createClient(baseConfig(mockFetch(() => ({ status: 200, body: {} }))))
    const { data } = await client.auth.getSession()
    expect(data).toBeNull()
  })

  it('returns session after sign-in', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 200, body: fakeSession }))),
    )
    await client.auth.signIn({ email: 'a@b.dz', password: 'x' })
    const { data } = await client.auth.getSession()
    expect(data?.access_token).toBe(VALID_TOKEN)
  })
})

describe('auth.getUser()', () => {
  it('returns 401 error when not signed in', async () => {
    const client = createClient(baseConfig(mockFetch(() => ({ status: 200, body: {} }))))
    const { data, error } = await client.auth.getUser()
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
  })

  it('fetches user from /auth/user after sign-in', async () => {
    let callCount = 0
    const client = createClient(
      baseConfig(
        mockFetch((input) => {
          callCount++
          const url = typeof input === 'string' ? input : (input as Request).url
          if (url.includes('/auth/login') || url.includes('/auth/signup')) {
            return { status: 200, body: fakeSession }
          }
          return { status: 200, body: fakeSession.user }
        }),
      ),
    )
    await client.auth.signIn({ email: 'a@b.dz', password: 'x' })
    const { data, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(data?.email).toBe('a@b.dz')
  })
})

describe('auth.onAuthStateChange()', () => {
  it('unsubscribes correctly', async () => {
    const client = createClient(
      baseConfig(mockFetch(() => ({ status: 200, body: fakeSession }))),
    )
    const events: string[] = []
    const { unsubscribe } = client.auth.onAuthStateChange((e) => events.push(e))
    unsubscribe()
    await client.auth.signIn({ email: 'a@b.dz', password: 'x' })
    expect(events).toHaveLength(0)
  })
})

describe('createClient()', () => {
  it('throws if url is missing', () => {
    expect(() =>
      createClient({ url: '', key: 'k', stage: 'production' }),
    ).toThrow('url is required')
  })

  it('throws if key is missing', () => {
    expect(() =>
      createClient({ url: 'https://api.example.com/v1/p', key: '', stage: 'production' }),
    ).toThrow('key is required')
  })

  it('throws if stage is missing', () => {
    expect(() =>
      createClient({ url: 'https://api.example.com/v1/p', key: 'k' } as any),
    ).toThrow('stage is required')
  })
})
