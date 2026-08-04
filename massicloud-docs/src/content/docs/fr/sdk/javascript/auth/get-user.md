---
title: getUser()
description: Obtenez l'utilisateur actuellement connecté.
---

## Signature

```ts
massi.auth.getUser(): Promise<{ data: { user: User | null }; error: MassiError | null }>
```

## Exemple

```ts
const { data: { user }, error } = await massi.auth.getUser()

if (!user) {
  console.log('Non connecté')
} else {
  console.log('Connecté en tant que :', user.email)
}
```

## Notes

- Retourne `null` pour `user` s'il n'y a pas de session active.
- Cet appel contacte le serveur pour valider le token — utilisez [`getSession()`](/fr/sdk/javascript/auth/get-session) pour une lecture locale qui évite l'aller-retour réseau.
