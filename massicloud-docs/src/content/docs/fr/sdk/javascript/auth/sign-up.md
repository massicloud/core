---
title: signUp()
description: Inscrivez un nouvel utilisateur avec son email et mot de passe.
---

## Signature

```ts
massi.auth.signUp(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## Exemple

```ts
const { data, error } = await massi.auth.signUp({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error(error.message)
  return
}

console.log('Utilisateur :', data.user.email)
console.log('Token :', data.access_token)
```

## Ce que ça fait

1. Envoie un POST à `/auth/signup` avec email + mot de passe
2. Hache le mot de passe côté serveur avec bcrypt
3. Insère une ligne dans votre table `auth.users`
4. Retourne une `Session` avec les tokens d'accès et de rafraîchissement
5. Le SDK stocke la session si `persistSession` est activé

## Réponse

En cas de succès :

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

En cas d'échec (ex. email déjà utilisé) :

```ts
{
  data: null,
  error: { message: 'user with this email already exists', status: 409 }
}
```

## Notes

- L'email est normalisé en minuscules avant stockage.
- La longueur minimale du mot de passe est de 6 caractères.
- Il n'y a pas encore d'étape de vérification d'email — les utilisateurs sont immédiatement actifs. La vérification par email est sur la feuille de route.
