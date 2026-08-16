---
title: Filtres
description: Filtrez les lignes avec eq, neq, gt, lt, like, in, et plus encore.
---

Les filtres restreignent les lignes retournées par `.select()`, mises à jour par `.update()`, ou supprimées par `.delete()`. Chaînez-en autant que nécessaire.

## Référence

Chaque filtre ci-dessous fonctionne avec Postgres.

| Méthode                         | Équivalent SQL                    |
| ------------------------------- | --------------------------------- |
| `.eq('col', value)`             | `col = value`                     |
| `.neq('col', value)`            | `col != value`                    |
| `.gt('col', value)`             | `col > value`                     |
| `.gte('col', value)`            | `col >= value`                    |
| `.lt('col', value)`             | `col < value`                     |
| `.lte('col', value)`            | `col <= value`                    |
| `.like('col', pattern)`         | `col LIKE pattern`                |
| `.ilike('col', pattern)`        | `col ILIKE pattern`               |
| `.is('col', null)`              | `col IS NULL`                     |
| `.in('col', [a, b])`            | `col IN (a, b)`                   |
| `.contains('col', [a])`         | `col @> ARRAY[a]` (colonne array) |
| `.containedBy('col', [a, b])`   | `col <@ ARRAY[a, b]`              |
| `.filter('col', 'op', value)`   | Échappatoire pour des ops arbitraires |

## Exemples

```ts
// Égalité
await massi.from('users').select('*').eq('role', 'admin')

// Plage
await massi.from('orders').select('*').gte('total', 1000).lt('total', 5000)

// Correspondance de motif (insensible à la casse)
await massi.from('products').select('*').ilike('name', '%phone%')

// Vérification de null
await massi.from('posts').select('*').is('deleted_at', null)

// Dans un ensemble
await massi.from('posts').select('*').in('status', ['draft', 'review'])

// Filtres multiples (AND)
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .gte('created_at', '2025-01-01')
  .order('created_at', { ascending: false })
```

Tous les filtres sont combinés avec AND. Les requêtes OR nécessitent l'échappatoire `.filter()` avec la syntaxe PostgREST brute ou une vue Postgres.
