---
title: Database (REST) API
description: HTTP endpoints for querying your Postgres database.
---

The REST API for querying tables follows [PostgREST](https://postgrest.org) conventions.

## Base path

```
/{stage}/db/{database-name}/rest/{table-name}
```

## GET — select rows

```
GET /production/db/main/rest/posts
```

Query parameters:

| Parameter  | Example                          | Effect                                  |
| ---------- | -------------------------------- | --------------------------------------- |
| `select`   | `id,title,created_at`            | Columns to return (default: `*`)        |
| `order`    | `created_at.desc`                | Sort column and direction               |
| `limit`    | `20`                             | Maximum rows                            |
| `offset`   | `40`                             | Skip rows (for pagination)              |
| `{col}`    | `published=eq.true`              | Filter: `col=op.value`                  |

Filter operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, `cs`, `cd`.

## POST — insert rows

```
POST /production/db/main/rest/posts
Content-Type: application/json
Prefer: return=representation

{ "title": "Hello", "body": "..." }
```

Pass an array for bulk inserts.

## PATCH — update rows

```
PATCH /production/db/main/rest/posts?id=eq.{uuid}
Content-Type: application/json

{ "title": "Updated" }
```

Always include a filter to avoid updating all rows.

## DELETE — delete rows

```
DELETE /production/db/main/rest/posts?id=eq.{uuid}
```

Always include a filter.
