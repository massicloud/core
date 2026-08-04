---
title: Authentication
description: How MassiCloud's three-tier auth model works.
---

MassiCloud has three roles you'll deal with: **anon**, **authenticated**, and **service_role**. Understanding them is the most important step in learning the platform.

## The three roles

| Role            | Who              | What it can do                                                              |
| --------------- | ---------------- | --------------------------------------------------------------------------- |
| `anon`          | Anyone           | Whatever your RLS policies allow `anon` to do                               |
| `authenticated` | A signed-in user | Whatever your RLS policies allow `authenticated`, scoped to that user via `auth.uid()` |
| `service_role`  | Your server      | Everything — bypasses all RLS                                               |

The role for a given request is determined by which key + token are sent.

## How a request gets a role

Every API request includes an `X-MassiCloud-Key` header — either your **anon key** or your **service key**:

```
X-MassiCloud-Key: mc_anon_xxxxx
```

That alone gives the request the `anon` role.

To get the `authenticated` role, the request ALSO includes an `Authorization: Bearer <jwt>` header with a JWT obtained from `signIn`:

```
X-MassiCloud-Key: mc_anon_xxxxx
Authorization:   Bearer eyJhbGc...
```

Now Postgres runs the query with `role = 'authenticated'` and `auth.uid()` returns the user's ID, which lets RLS policies do per-user filtering.

To get `service_role`, send the service key directly:

```
X-MassiCloud-Key: mc_service_xxxxx
```

This bypasses all RLS — use it from trusted server-side code only.

## The keys

- **Anon key** (`mc_anon_...`) — Public. Ship in browsers and mobile apps. By itself it can only do what RLS policies allow the `anon` role to do.
- **Service key** (`mc_service_...`) — Secret. NEVER ship in client code. Bypasses RLS.

If you accidentally leak a service key, rotate it immediately from the portal's API Keys page.

## MySQL instances: no per-row auth

Everything above describes Postgres, where Row Level Security lets `anon` and `authenticated` see different rows of the *same* table. MySQL has no RLS equivalent, so [MySQL databases](/concepts/mysql) only have two roles: `massi_anon` (read-only, every row) and `massi_service` (full access). There's no `authenticated` role and no per-user row filtering — if you need that, filter in your application code, or use Postgres.

## End-user authentication

End-users — the actual customers of your app — sign up and sign in via the auth endpoints. The SDK wraps these:

```js
await massi.auth.signUp({ email, password })
await massi.auth.signIn({ email, password })
await massi.auth.signOut()
```

This stores the user in your project's `auth.users` table (in your tenant Postgres) and returns a JWT signed with your project's secret. The SDK manages this token for you — auto-refresh, storage, etc.

## What's stored where

| What                                      | Where                                             |
| ----------------------------------------- | ------------------------------------------------- |
| Your platform login (you, the developer)  | MassiCloud's central control plane                |
| Project API keys (anon, service)          | MassiCloud's control plane                        |
| End-user accounts (your app's users)      | YOUR tenant Postgres in `auth.users`              |
| End-user JWTs                             | Client-side, managed by the SDK                   |

End-users are project-scoped — they live in your tenant database, not in a shared central system. Two different projects can have users with the same email without conflict.
