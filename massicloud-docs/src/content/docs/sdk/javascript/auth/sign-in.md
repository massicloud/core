---
title: signIn()
description: Sign in an existing user with email and password.
---

## Signature

```ts
massi.auth.signIn(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## Example

```ts
const { data, error } = await massi.auth.signIn({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error('Sign in failed:', error.message)
  return
}

console.log('Welcome back,', data.user.email)
```

## Response

Same shape as [`signUp`](/sdk/javascript/auth/sign-up#response):

```ts
{
  data: {
    user:          { id, email, created_at, ... },
    access_token:  'eyJhbGc...',
    refresh_token: 'eyJhbGc...',
    expires_at:    1718284800,
    token_type:    'Bearer'
  },
  error: null
}
```

On failure (wrong password or user not found):

```ts
{
  data: null,
  error: { message: 'invalid email or password', status: 401 }
}
```

## Notes

- The SDK stores the session automatically if `persistSession` is enabled (default in browsers).
- The access token expires in 1 hour. The SDK refreshes it automatically via the refresh token.
- To check who is signed in at any time, call [`getUser()`](/sdk/javascript/auth/get-user).
