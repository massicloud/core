---
title: Authentication API
description: HTTP endpoints for user authentication.
---

All auth endpoints are under `/auth` relative to your project base URL.

## POST /auth/signup

Register a new user.

**Request body:**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**Response (201):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.dz", "created_at": "..." },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_at": 1718284800,
    "token_type": "Bearer"
  },
  "error": null
}
```

## POST /auth/login

Sign in an existing user.

**Request body:**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**Response (200):** Same shape as signup.

## POST /auth/logout

Invalidate the current refresh token.

**Headers:** Requires `Authorization: Bearer <access_token>`

**Response (200):**
```json
{ "data": null, "error": null }
```

## POST /auth/refresh

Exchange a refresh token for a new access token.

**Request body:**
```json
{ "refresh_token": "eyJ..." }
```

**Response (200):** Same shape as login.

## GET /auth/user

Get the currently authenticated user.

**Headers:** Requires `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "data": { "user": { "id": "...", "email": "...", "created_at": "..." } },
  "error": null
}
```
