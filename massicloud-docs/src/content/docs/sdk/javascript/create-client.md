---
title: createClient()
description: Create a MassiCloud client instance.
---

`createClient(config)` constructs the client used for all API calls.

## Signature

```ts
createClient(config: MassiCloudConfig): MassiCloudClient
```

## Parameters

```ts
interface MassiCloudConfig {
  url:    string              // Required. Base URL with project slug.
  key:    string              // Required. Anon or service key.
  stage:  string              // Required. e.g. 'production', 'staging'.
  db?:    string              // Optional. Defaults to 'main'.
  auth?:  AuthConfig          // Optional. Session persistence.
  fetch?: typeof fetch        // Optional. Custom fetch.
  headers?: Record<string, string>
}
```

## Examples

### Browser (default)

```ts
const massi = createClient({
  url:   'https://api.massicloud.dz/v1/my-project',
  key:   import.meta.env.VITE_MASSI_KEY,
  stage: 'production',
})
// Session persists in localStorage, auto-refresh.
```

### Server-side (Node)

```ts
const massi = createClient({
  url:   process.env.MASSI_URL!,
  key:   process.env.MASSI_SERVICE_KEY!,  // service key, bypasses RLS
  stage: 'production',
  auth:  { persistSession: false },
})
```

### React Native with AsyncStorage

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const massi = createClient({
  url:   '...',
  key:   '...',
  stage: 'production',
  auth:  {
    storage: AsyncStorage,
    persistSession: true,
  },
})
```

### Multiple stages

One client per stage:

```ts
const prod = createClient({ url, key, stage: 'production' })
const stg  = createClient({ url, key, stage: 'staging' })
```

### Multiple databases in the same stage

The default `db` is `'main'`. Switch ad-hoc with `.db(name)`:

```ts
const massi = createClient({ url, key, stage: 'production' })

// Default db ('main')
await massi.from('users').select()

// A different db in the same stage
await massi.db('analytics').from('events').select()
```

The auth session is shared across all databases in the same stage.
