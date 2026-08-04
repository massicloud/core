---
title: update()
description: Mettez à jour les lignes correspondant à un filtre.
---

## Signature

```ts
builder.update(values: Partial<T>): this
```

Chaînez toujours `.eq()` ou un autre filtre — sans filtre, `update()` tentera de mettre à jour chaque ligne de la table.

## Exemples

```ts
// Mettre à jour une seule ligne par ID
const { data, error } = await massi
  .from('posts')
  .update({ title: 'Titre mis à jour' })
  .eq('id', postId)
  .single()

// Mettre à jour plusieurs lignes
const { data } = await massi
  .from('posts')
  .update({ published: true })
  .eq('draft', false)
```

## RLS

La mise à jour doit satisfaire :

- `USING` — la ligne doit correspondre à la politique pour que l'utilisateur actuel puisse la voir
- `WITH CHECK` — la ligne mise à jour doit toujours satisfaire la politique

## Réponse

```ts
{
  data:  T[] | null,    // Les lignes mises à jour
  error: MassiError | null,
}
```
