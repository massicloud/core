---
title: update()
description: Update rows that match a filter.
---

## Signature

```ts
builder.update(values: Partial<T>): this
```

Always chain `.eq()` or another filter — without a filter, `update()` will attempt to update every row in the table.

## Examples

```ts
// Update a single row by ID
const { data, error } = await massi
  .from('posts')
  .update({ title: 'Updated title' })
  .eq('id', postId)
  .single()

// Update multiple rows
const { data } = await massi
  .from('posts')
  .update({ published: true })
  .eq('draft', false)
```

## RLS

The update must satisfy:

- `USING` — the row must match the policy for the current user to see it
- `WITH CHECK` — the updated row must still satisfy the policy

## Response

```ts
{
  data:  T[] | null,    // The updated rows
  error: MassiError | null,
}
```
