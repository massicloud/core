---
title: select()
description: Read rows from a table.
---

## Signature

```ts
builder.select(columns?: string): this
```

`columns` defaults to `'*'`. Pass a comma-separated string for specific columns.

## Examples

```ts
// All columns
await massi.from('posts').select('*')

// Specific columns
await massi.from('posts').select('id, title, created_at')

// With filters
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .order('created_at', { ascending: false })
```

## Response

```ts
{
  data:  Post[] | null,
  error: MassiError | null,
  count: number | null,
}
```

See [Filters](/sdk/javascript/rest/filters) and [Modifiers](/sdk/javascript/rest/modifiers) for the full query surface.
