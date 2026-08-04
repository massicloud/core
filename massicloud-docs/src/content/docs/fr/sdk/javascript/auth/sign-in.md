---
title: signIn()
description: Connectez un utilisateur existant avec son email et mot de passe.
---

## Signature

```ts
massi.auth.signIn(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## Exemple

```ts
const { data, error } = await massi.auth.signIn({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error('Connexion échouée :', error.message)
  return
}

console.log('Bienvenue,', data.user.email)
```

## Réponse

Même structure que [`signUp`](/fr/sdk/javascript/auth/sign-up#réponse) :

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

En cas d'échec (mauvais mot de passe ou utilisateur introuvable) :

```ts
{
  data: null,
  error: { message: 'invalid email or password', status: 401 }
}
```

## Notes

- Le SDK stocke la session automatiquement si `persistSession` est activé (défaut dans les navigateurs).
- Le token d'accès expire dans 1 heure. Le SDK le rafraîchit automatiquement via le refresh token.
- Pour vérifier qui est connecté à tout moment, appelez [`getUser()`](/fr/sdk/javascript/auth/get-user).
