---
title: API Reference Overview
description: MassiCloud's HTTP API — base URLs, authentication, and conventions.
---

The MassiCloud API is a RESTful HTTP API. The JavaScript SDK is a thin wrapper around it; you can call it directly from any language.

## Base URL

```
https://api.massicloud.dz/v1/{project-slug}
```

Your project slug is shown in the portal under Project → Settings.

## Authentication

Every request requires the `X-MassiCloud-Key` header:

```
X-MassiCloud-Key: mc_anon_your_key
```

For authenticated requests (to invoke RLS as a specific user), also include:

```
Authorization: Bearer eyJhbGc...
```

## Content type

All request and response bodies are JSON:

```
Content-Type: application/json
Accept: application/json
```

## Response shape

All endpoints return:

```ts
{
  data:  T | null,
  error: { message: string; status: number } | null,
}
```

## Sections

- [Authentication endpoints](/api-reference/authentication)
- [Database (REST) endpoints](/api-reference/database)
- [Error codes](/api-reference/errors)
