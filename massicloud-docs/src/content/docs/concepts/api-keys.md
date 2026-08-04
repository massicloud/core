---
title: API Keys
description: Understanding MassiCloud's anon and service keys.
---

Every project has two API keys, shared across every database in the project — Postgres and [MySQL](/concepts/mysql) alike. They determine the role used for requests and control access to your data. The rest of this page describes the Postgres role/RLS model; MySQL databases use a simpler two-role model with no RLS equivalent — see [Authentication: MySQL instances](/concepts/authentication#mysql-instances-no-per-row-auth).

## Anon key (`mc_anon_…`)

Safe to include in browser and mobile code. By itself it grants only the `anon` Postgres role, which means requests are subject to your RLS policies. The anon key cannot do anything your policies don't explicitly allow.

Use environment variables to avoid hardcoding it:

```js
// Vite
const massi = createClient({ key: import.meta.env.VITE_MASSI_KEY, ... })

// Next.js
const massi = createClient({ key: process.env.NEXT_PUBLIC_MASSI_KEY, ... })
```

## Service key (`mc_service_…`)

Never expose this in client code. It grants the `service_role` Postgres role, which bypasses all RLS policies. Use it for:

- Server-side API routes
- Background jobs and workers
- Admin scripts and migrations

## Rotating keys

Go to **Project → API Keys → Rotate** in the portal. Old keys stop working immediately. Update your deployments before rotating.

## What happens if a key leaks

If your anon key leaks, rotate it. The damage is limited by your RLS policies, but a bad actor could read/write anything `anon` is allowed to do.

If your service key leaks, rotate it immediately — it bypasses all RLS. Treat it like a database root password.
