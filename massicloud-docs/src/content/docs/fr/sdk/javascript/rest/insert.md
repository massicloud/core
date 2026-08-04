---
title: insert()
description: Insérez des lignes dans une table.
---

## Signature

```ts
builder.insert(values: Partial<T> | Partial<T>[]): this
```

## Exemples

```ts
// Ligne unique
const { data, error } = await massi
  .from('posts')
  .insert({ title: 'Bonjour', body: '...' })
  .single()

// Plusieurs lignes
const { data } = await massi
  .from('posts')
  .insert([
    { title: 'A', body: '...' },
    { title: 'B', body: '...' },
  ])
```

Par défaut, les lignes insérées sont retournées (le SDK envoie `Prefer: return=representation`).

## RLS

L'insertion doit satisfaire toute politique RLS sur la table qui utilise `WITH CHECK`. Cas courant : `WITH CHECK (user_id = auth.uid())` — vous n'avez pas besoin de définir `user_id` explicitement s'il a une valeur par défaut de colonne `auth.uid()`.

## Réponse

```ts
{
  data:  T[] | null,    // Les lignes insérées
  error: MassiError | null,
}
```
