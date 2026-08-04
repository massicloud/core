---
title: signOut()
description: Déconnectez l'utilisateur actuel et effacez la session.
---

## Signature

```ts
massi.auth.signOut(): Promise<{ error: MassiError | null }>
```

## Exemple

```ts
const { error } = await massi.auth.signOut()

if (error) {
  console.error('Déconnexion échouée :', error.message)
}
// Session effacée — massi.auth.getUser() retourne maintenant null
```

## Ce que ça fait

1. Envoie un POST à `/auth/logout` pour invalider le refresh token côté serveur
2. Supprime la session du stockage local (ou de votre stockage personnalisé)
3. Déclenche `onAuthStateChange` avec `SIGNED_OUT`

## Notes

- Même si l'appel réseau échoue, la session locale est effacée.
- Après la déconnexion, les appels suivants nécessitant une authentification retourneront `401` tant que vous ne vous reconnectez pas.
