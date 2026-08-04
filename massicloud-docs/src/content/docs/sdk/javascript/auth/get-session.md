---
title: getSession()
description: Get the current session from local storage without a network call.
---

## Signature

```ts
massi.auth.getSession(): Promise<{ data: { session: Session | null }; error: MassiError | null }>
```

## Example

```ts
const { data: { session } } = await massi.auth.getSession()

if (session) {
  console.log('Access token:', session.access_token)
  console.log('Expires at:', new Date(session.expires_at * 1000))
}
```

## Notes

- Reads from local storage — no network call.
- The token may be expired; the SDK refreshes it if `autoRefreshToken` is enabled (default).
- Prefer [`getUser()`](/sdk/javascript/auth/get-user) when you need to validate the token server-side.
