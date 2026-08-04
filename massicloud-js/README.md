# @massicloud/client

Official JavaScript/TypeScript client for **MassiCloud** — the sovereign cloud platform for Algeria.

```bash
npm install @massicloud/client
```

> **Migrating from v0.1?** The config now requires `stage`. Replace
> `createClient({ url, key, db: 'foo' })` with
> `createClient({ url, key, stage: 'production', db: 'foo' })`.

## Quick start

```ts
import { createClient } from '@massicloud/client'

const massi = createClient({
  url:   'https://api.massicloud.dz/v1/your-project',
  key:   'mc_anon_your_key_here',
  stage: 'production',
  // db defaults to 'main'
})

// Sign up a user
const { data: session } = await massi.auth.signUp({
  email: 'user@example.dz',
  password: 'secret123',
})

// Insert a row
const { data: post } = await massi
  .from('posts')
  .insert({ title: 'Hello Algeria' })
  .single()

// Query with filters
const { data: posts } = await massi
  .from('posts')
  .select('*')
  .eq('user_id', session!.user.id)
  .order('created_at', { ascending: false })
  .limit(10)
```

## Multiple databases

A stage can have many named databases. Use `.db(name)` to switch ad-hoc:

```ts
// Default db ('main')
await massi.from('users').select()

// A different db in the same stage
await massi.db('analytics').from('events').select()

// Chain — returns a full client, not just a query builder
const analytics = massi.db('analytics')
await analytics.from('events').insert({ name: 'page_view' })
```

The auth session is shared across all databases in the same stage. Signing in
via `massi.auth.signIn()` makes the session immediately available on
`massi.db('analytics').auth.getSession()` and vice versa.

## Multiple stages

For multi-environment setups, create one client per stage:

```ts
const prod = createClient({ url, key, stage: 'production' })
const stg  = createClient({ url, key, stage: 'staging' })
```

## Authentication

```ts
// Sign up
await massi.auth.signUp({ email, password })

// Sign in
const { data, error } = await massi.auth.signIn({ email, password })

// Get current user
const { data: user } = await massi.auth.getUser()

// Listen to auth state changes
const { unsubscribe } = massi.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN')       console.log('Welcome', session?.user.email)
  if (event === 'SIGNED_OUT')      console.log('Goodbye')
  if (event === 'TOKEN_REFRESHED') console.log('Token refreshed silently')
})

// Sign out
await massi.auth.signOut()

// Clean up listener
unsubscribe()
```

## REST queries

```ts
// Select all
await massi.from('posts').select('*')

// Select specific columns
await massi.from('posts').select('id, title, created_at')

// Filters
await massi.from('posts').select('*').eq('user_id', 'uuid')
await massi.from('posts').select('*').neq('status', 'deleted')
await massi.from('posts').select('*').gte('created_at', '2026-01-01')
await massi.from('posts').select('*').ilike('title', '%algeria%')
await massi.from('posts').select('*').in('status', ['draft', 'published'])
await massi.from('posts').select('*').is('deleted_at', null)

// Order, limit, offset
await massi.from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)
  .offset(20)

// Single row
const { data: post, error } = await massi
  .from('posts').select('*').eq('id', 'uuid').single()

// Maybe single (0 or 1 row — no error on empty)
const { data } = await massi
  .from('posts').select('*').eq('slug', 'intro').maybeSingle()

// Insert
await massi.from('posts').insert({ title: 'Hi', body: '...' })

// Insert multiple
await massi.from('posts').insert([
  { title: 'First' },
  { title: 'Second' },
])

// Update
await massi.from('posts').update({ title: 'Updated' }).eq('id', 'uuid')

// Delete
await massi.from('posts').delete().eq('id', 'uuid')
```

## Object storage

Storage is project-scoped (not tied to a stage/db). MinIO credentials never
reach the client — every call goes through the API, which mediates access
and only ever hands back time-limited, credential-free download links.

```ts
// List objects under a prefix
const { data: list } = await massi.storage.from('avatars').list('users/')

// Upload (requires a signed-in end user — anonymous writes are never allowed,
// even to public buckets)
const file = new Blob(['hello'], { type: 'text/plain' })
await massi.storage.from('avatars').upload('users/42/photo.txt', file)

// Download bytes directly (private buckets require a signed-in end user)
const { data: blob } = await massi.storage.from('avatars').download('users/42/photo.txt')

// Create a shareable, expiring signed URL (works for private buckets too,
// as long as the caller currently has read access)
const { data: signed } = await massi.storage
  .from('avatars')
  .createSignedUrl('users/42/photo.txt', 3600)
console.log(signed?.url)

// Remove an object (requires a signed-in end user)
await massi.storage.from('avatars').remove('users/42/photo.txt')
```

## TypeScript generics

```ts
interface Post {
  id: string
  title: string
  body: string
  created_at: string
}

const { data } = await massi.from<Post>('posts').select('*').single()
// data is typed as Post | null
```

## Response shape

Every query returns `{ data, error }`. Exactly one is non-null.

```ts
const { data, error } = await massi.from('posts').select('*')

if (error) {
  console.error(error.message, error.status)
} else {
  console.log(data)
}
```

## Redis and other database types

This SDK covers the **Postgres + REST + Auth** side of MassiCloud.
For Redis instances in your stage, use the standard `redis` package
with the connection string shown in your portal:

```ts
import { createClient as createRedisClient } from 'redis'

const cache = createRedisClient({
  url: process.env.MASSI_REDIS_URL,
})
await cache.connect()
```

## Environment support

| Environment                     | Notes |
|---------------------------------|-------|
| **Browser**                     | Session persists in `localStorage`; tokens auto-refresh silently |
| **Node 18+**                    | Uses native `fetch`; session is in-memory only by default |
| **React Native**                | Pass `auth.storage: AsyncStorage` |
| **Edge (Vercel, CF Workers)**   | Works out of the box |
| **Node < 18**                   | Pass a `fetch` implementation: `import fetch from 'node-fetch'` |

## Custom storage (React Native)

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const massi = createClient({
  url, key, stage: 'production',
  auth: {
    storage: AsyncStorage,
    persistSession: true,
  },
})
```

## License

MIT © Amine Kessar / MassiCloud
