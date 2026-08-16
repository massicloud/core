---
title: Filters
description: Filter rows with eq, neq, gt, lt, like, in, and more.
---

Filters narrow which rows are returned by `.select()`, updated by `.update()`, or deleted by `.delete()`. Chain as many as you need.

## Reference

Every filter below works against Postgres.

| Method                          | SQL equivalent                    |
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
| `.contains('col', [a])`         | `col @> ARRAY[a]` (array column)  |
| `.containedBy('col', [a, b])`   | `col <@ ARRAY[a, b]`              |
| `.filter('col', 'op', value)`   | Escape hatch for arbitrary ops    |

## Examples

```ts
// Equality
await massi.from('users').select('*').eq('role', 'admin')

// Range
await massi.from('orders').select('*').gte('total', 1000).lt('total', 5000)

// Pattern match (case-insensitive)
await massi.from('products').select('*').ilike('name', '%phone%')

// Null check
await massi.from('posts').select('*').is('deleted_at', null)

// In a set
await massi.from('posts').select('*').in('status', ['draft', 'review'])

// Multiple filters (AND)
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .gte('created_at', '2025-01-01')
  .order('created_at', { ascending: false })
```

All filters are AND-ed together. OR queries require the `.filter()` escape hatch with raw PostgREST syntax or a Postgres view.
