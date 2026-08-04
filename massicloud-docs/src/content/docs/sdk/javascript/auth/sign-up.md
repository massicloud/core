---
title: signUp()
description: Register a new end-user with email and password.
---

## Signature

```ts
massi.auth.signUp(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## Example

```ts
const { data, error } = await massi.auth.signUp({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error(error.message)
  return
}

console.log('User:', data.user.email)
console.log('Token:', data.access_token)
```

## What it does

1. Sends a POST to `/auth/signup` with email + password
2. Hashes the password server-side with bcrypt
3. Inserts a row into your `auth.users` table
4. Returns a `Session` with access + refresh tokens
5. The SDK stores the session if `persistSession` is enabled

## Response

On success:

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

On failure (e.g. email already exists):

```ts
{
  data: null,
  error: { message: 'user with this email already exists', status: 409 }
}
```

## Notes

- Email is normalized to lowercase before storage.
- Minimum password length is 6 characters.
- No email verification step exists yet — users are immediately active. Email verification is on the roadmap.
