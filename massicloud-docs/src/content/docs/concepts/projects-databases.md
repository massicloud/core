---
title: Projects & Databases
description: How MassiCloud organizes your resources.
---

## Projects

A project is the top-level organizational unit in MassiCloud. Think of it as one application. A project owns:

- Databases (Postgres, MySQL) and Redis instances
- Storage buckets
- API keys (anon and service)
- End-user accounts

You typically create one project per application. If you need staging and production environments, create two projects — or use two databases within one project.

## API Keys

When you create a project, two keys are generated:

| Key | Prefix | Purpose |
| --- | ------ | ------- |
| Anon key | `mc_anon_` | Browser / mobile apps. Subject to RLS. |
| Service key | `mc_service_` | Server-side only. Bypasses RLS. |

The service key is shown **once** at creation. Store it in your secrets manager immediately.

## Databases

Each database within a project is either a Postgres instance or a [MySQL](/concepts/mysql) instance — chosen when you create it. You can have multiple databases per project, of either type (e.g., a Postgres `production` alongside a MySQL `legacy`).

### The `auth` schema

The `auth` schema and everything below it (RLS, `auth.uid()`, etc.) applies to **Postgres** databases. MySQL databases use a simpler two-role model instead — see [Authentication: MySQL instances](/concepts/authentication#mysql-instances-no-per-row-auth).

When you enable the auth schema on a database, MassiCloud creates:

- `auth.users` — your app's end-users
- `auth.sessions` — active sessions
- Helper functions: `auth.uid()`, `auth.role()`, `auth.email()`

These are used by RLS policies to scope data access per user.

### The `public` schema

Your application tables live here by default. Tables created through the portal or migrations land in `public.*`.

### Redis

Redis databases are available for caching, pub/sub, and rate-limiting. They are not exposed via the REST API — connect via standard Redis client libraries using the connection string from the portal.
