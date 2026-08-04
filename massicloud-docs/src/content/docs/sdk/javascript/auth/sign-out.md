---
title: signOut()
description: Sign out the current user and clear the session.
---

## Signature

```ts
massi.auth.signOut(): Promise<{ error: MassiError | null }>
```

## Example

```ts
const { error } = await massi.auth.signOut()

if (error) {
  console.error('Sign out failed:', error.message)
}
// Session cleared — massi.auth.getUser() now returns null
```

## What it does

1. Sends a POST to `/auth/logout` to invalidate the refresh token on the server
2. Removes the session from local storage (or your custom storage)
3. Triggers `onAuthStateChange` with `SIGNED_OUT`

## Notes

- Even if the network call fails, the local session is cleared.
- After sign-out, subsequent calls that require authentication will return `401` unless you sign in again.
