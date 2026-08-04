---
title: getUser()
description: Get the currently signed-in user.
---

## Signature

```ts
massi.auth.getUser(): Promise<{ data: { user: User | null }; error: MassiError | null }>
```

## Example

```ts
const { data: { user }, error } = await massi.auth.getUser()

if (!user) {
  console.log('Not signed in')
} else {
  console.log('Signed in as:', user.email)
}
```

## Notes

- Returns `null` for `user` if there is no active session.
- This call hits the server to validate the token — use [`getSession()`](/sdk/javascript/auth/get-session) for a local-only read that avoids the network round-trip.
