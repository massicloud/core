---
title: JavaScript SDK
description: The official MassiCloud client for JavaScript and TypeScript.
---

`@massicloud/client` is the official MassiCloud client for JavaScript and TypeScript. It works in browsers, Node.js, React Native, and edge runtimes.

## What it does

- Authenticate end-users (sign up, sign in, sign out)
- Query Postgres tables via the REST API
- Read, write, and create signed URLs for object storage buckets
- Manage tokens automatically (refresh, persistence)
- Same API shape as Supabase (intentional — migration is mostly a search-and-replace)

## Install

```bash
npm install @massicloud/client
```

Requires Node 18+ for the built-in `fetch`.

## A minimal example

```ts
import { createClient } from '@massicloud/client'

const massi = createClient({
  url: 'https://api.massicloud.dz/v1/my-project',
  key: 'mc_anon_my-key',
  db:  'production',
})

// Sign in
const { data, error } = await massi.auth.signIn({
  email: 'me@example.dz',
  password: 'secret',
})

// Query
const { data: todos } = await massi
  .from('todos')
  .select('*')
  .eq('completed', false)
```

## Next

- [Installation](/sdk/javascript/installation)
- [Create a client](/sdk/javascript/create-client)
- [signUp](/sdk/javascript/auth/sign-up)
- [from()](/sdk/javascript/rest/from)
- [Storage overview](/sdk/javascript/storage/overview)
