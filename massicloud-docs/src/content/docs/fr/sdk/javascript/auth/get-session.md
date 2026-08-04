---
title: getSession()
description: Obtenez la session courante depuis le stockage local sans appel réseau.
---

## Signature

```ts
massi.auth.getSession(): Promise<{ data: { session: Session | null }; error: MassiError | null }>
```

## Exemple

```ts
const { data: { session } } = await massi.auth.getSession()

if (session) {
  console.log('Token d\'accès :', session.access_token)
  console.log('Expire le :', new Date(session.expires_at * 1000))
}
```

## Notes

- Lit depuis le stockage local — aucun appel réseau.
- Le token peut être expiré ; le SDK le rafraîchit si `autoRefreshToken` est activé (défaut).
- Préférez [`getUser()`](/fr/sdk/javascript/auth/get-user) lorsque vous devez valider le token côté serveur.
