---
title: MySQL
description: MySQL 8.4 as a first-class database option, with REST CRUD and SDK compatibility.
---

Alongside Postgres, MassiCloud can provision a dedicated **MySQL 8.4 LTS** instance per database. It gets the same REST-over-HTTP ergonomics as Postgres — same URL shape, same SDK calls — powered by a lightweight MassiCloud-built REST service instead of PostgREST.

## When to choose MySQL vs Postgres

Postgres is the default and the more capable option — Row Level Security, `json`/`jsonb`, extensions, embedded relation queries (`select=*,posts(*)`), full SQL. Reach for MySQL when:

- You're porting an existing app or ORM schema already written for MySQL.
- Your team's operational experience is with MySQL specifically.
- You don't need per-row authorization — MySQL databases only have two access levels (see [Authentication](/concepts/authentication#mysql-instances-no-per-row-auth)).

If you're starting fresh and don't have a specific reason to pick MySQL, use Postgres.

## What's supported

- **REST CRUD** — `GET`/`POST`/`PATCH`/`DELETE` on `/rest/{table}`, identical URL shape to Postgres.
- **Basic filtering** — a subset of PostgREST's filter syntax: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `in`, `is null` / `is not null`, plus `select`, `order`, `limit`, `offset`.
- **The SQL console** in the portal, with MySQL-specific quick-start queries (`SHOW TABLES`, `EXPLAIN`, `SHOW ENGINE INNODB STATUS`, etc.).
- **Schema presets** at creation time (a blank database, or a basic `users` table).

## What's not supported

- **Row Level Security** — MySQL has no RLS equivalent. Every request is either `massi_anon` (read-only) or `massi_service` (full access); there's no per-user row filtering. Filter in your application code if you need that.
- **Embedded relations** — PostgREST-style `select=*,posts(*)` joins aren't implemented. Use the SQL console for anything beyond single-table filtering.
- **Custom RPC / stored functions** — no equivalent to Postgres's `rpc()` calls yet.
- **Realtime** — no equivalent to Postgres's `LISTEN`/`NOTIFY`-based realtime; MySQL has no comparable primitive.
- **Backups** — not yet wired up for MySQL instances (Postgres instances back up automatically).

If your code hits one of these, the mysql-rest service returns a `400` explaining the filter isn't supported — it won't silently return wrong data.

## Example

Creating and using a MySQL database looks the same as Postgres from the SDK's perspective:

```ts
const massi = createClient({
  url: 'https://api.massicloud.work',
  key: anonKey,
  stage: 'production',
  db: 'mysql_main',
})

const { data, error } = await massi.from('users').select().eq('email', 'someone@example.dz')
```

The SDK doesn't know or care whether `mysql_main` is Postgres or MySQL — the platform routes the request to the right REST sidecar server-side, based on how the database was provisioned.

## Auth model

Two fixed roles, set up automatically when the instance is created:

| Role            | Access                          |
| --------------- | -------------------------------- |
| `massi_anon`    | `SELECT` only, every row          |
| `massi_service` | Full read/write, every row        |

Which one a request gets depends on whether you sent your anon key or your service key — same as Postgres, just without the `authenticated` tier or RLS-based row filtering in between.
