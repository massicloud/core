---
title: insert()
description: Insert rows into a table.
---

## Signature

```ts
builder.insert(values: Partial<T> | Partial<T>[]): this
```

## Examples

```ts
// Single row
const { data, error } = await massi
  .from('posts')
  .insert({ title: 'Hello', body: '...' })
  .single()

// Multiple rows
const { data } = await massi
  .from('posts')
  .insert([
    { title: 'A', body: '...' },
    { title: 'B', body: '...' },
  ])
```

By default, the inserted rows are returned (the SDK sets `Prefer: return=representation`).

## RLS

The insert must satisfy any RLS policy on the table that uses `WITH CHECK`. Common case: `WITH CHECK (user_id = auth.uid())` — you don't need to set `user_id` explicitly if it has a column default of `auth.uid()`.

## Response

```ts
{
  data:  T[] | null,    // The inserted rows
  error: MassiError | null,
}
```
