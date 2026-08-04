---
title: select()
description: Lisez des lignes depuis une table.
---

## Signature

```ts
builder.select(columns?: string): this
```

`columns` vaut `'*'` par défaut. Passez une chaîne séparée par des virgules pour des colonnes spécifiques.

## Exemples

```ts
// Toutes les colonnes
await massi.from('posts').select('*')

// Colonnes spécifiques
await massi.from('posts').select('id, title, created_at')

// Avec filtres
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .order('created_at', { ascending: false })
```

## Réponse

```ts
{
  data:  Post[] | null,
  error: MassiError | null,
  count: number | null,
}
```

Consultez [Filtres](/fr/sdk/javascript/rest/filters) et [Modificateurs](/fr/sdk/javascript/rest/modifiers) pour la surface de requête complète.
