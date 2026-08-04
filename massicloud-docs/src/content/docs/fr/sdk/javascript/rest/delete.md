---
title: delete()
description: Supprimez les lignes correspondant à un filtre.
---

## Signature

```ts
builder.delete(): this
```

Chaînez toujours `.eq()` ou un autre filtre — sans filtre, `delete()` tentera de supprimer chaque ligne de la table.

## Exemples

```ts
// Supprimer par ID
const { error } = await massi
  .from('posts')
  .delete()
  .eq('id', postId)

// Supprimer tous les brouillons de l'utilisateur actuel
const { data } = await massi
  .from('posts')
  .delete()
  .eq('draft', true)
  .eq('user_id', userId)
```

## RLS

La ligne doit passer la clause `USING` de toute politique `DELETE` pour l'utilisateur actuel.

## Réponse

```ts
{
  data:  T[] | null,    // Les lignes supprimées (si return=representation)
  error: MassiError | null,
}
```
