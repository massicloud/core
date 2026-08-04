---
title: Platform Overview
description: The key concepts behind MassiCloud.
---

MassiCloud is organized around a small set of core ideas. Understanding them makes everything else obvious.

## Projects

A **project** is the top-level container. One project per app. It owns:

- One or more **databases** (Postgres or MySQL) and **Redis** instances
- **Storage buckets** for files
- **API keys** (anon + service)
- **End-users** (your app's customers)

[Projects & Databases →](/concepts/projects-databases)

## Databases

Every database is a managed instance with a REST API auto-generated on top — Postgres via PostgREST, or [MySQL](/concepts/mysql) via MassiCloud's own lightweight REST sidecar. You interact with it via the SDK or directly via HTTP. You can also connect with any Postgres/MySQL client for migrations, queries, etc.

## Authentication

Three roles govern every request: `anon`, `authenticated`, and `service_role`. Which role applies depends on which key and JWT are sent with the request.

[Authentication →](/concepts/authentication)

## Row Level Security

Data access is controlled by Postgres RLS policies. The database itself enforces who can read, insert, update, or delete rows — not your application code.

[Row Level Security →](/concepts/rls)

## Sovereignty

All data stays in Algeria. No cross-border transfers. Compliant with Law 18-07 and 25-11 by construction.

[Sovereignty & Compliance →](/concepts/sovereignty)
