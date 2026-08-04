---
title: onAuthStateChange()
description: Abonnez-vous aux changements d'état d'authentification.
---

## Signature

```ts
massi.auth.onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { data: { subscription: Subscription } }
```

## Exemple

```ts
const { data: { subscription } } = massi.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('Utilisateur connecté :', session?.user.email)
  }
  if (event === 'SIGNED_OUT') {
    console.log('Utilisateur déconnecté')
  }
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token rafraîchi')
  }
})

// Plus tard, nettoyage :
subscription.unsubscribe()
```

## Événements

| Événement         | Quand il se déclenche                                   |
| ----------------- | ------------------------------------------------------- |
| `SIGNED_IN`       | Après que `signIn()` ou `signUp()` réussit              |
| `SIGNED_OUT`      | Après `signOut()` ou invalidation du token              |
| `TOKEN_REFRESHED` | Après que le SDK rafraîchit automatiquement le token    |
| `USER_UPDATED`    | Après modification des métadonnées utilisateur          |

## Notes

- Appelez toujours `subscription.unsubscribe()` lors du démontage du composant (React, Vue, Svelte) pour éviter les fuites mémoire.
- Le callback se déclenche une première fois immédiatement avec l'état de session actuel lors de l'abonnement.
