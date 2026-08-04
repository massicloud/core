---
title: onAuthStateChange()
description: Subscribe to auth state changes.
---

## Signature

```ts
massi.auth.onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { data: { subscription: Subscription } }
```

## Example

```ts
const { data: { subscription } } = massi.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user.email)
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out')
  }
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed')
  }
})

// Later, clean up:
subscription.unsubscribe()
```

## Events

| Event             | When it fires                                      |
| ----------------- | -------------------------------------------------- |
| `SIGNED_IN`       | After `signIn()` or `signUp()` succeeds            |
| `SIGNED_OUT`      | After `signOut()` or token invalidation            |
| `TOKEN_REFRESHED` | After the SDK automatically refreshes the token    |
| `USER_UPDATED`    | After user metadata changes                        |

## Notes

- Always call `subscription.unsubscribe()` on component unmount (React, Vue, Svelte) to avoid memory leaks.
- The callback fires once immediately with the current session state when subscribed.
