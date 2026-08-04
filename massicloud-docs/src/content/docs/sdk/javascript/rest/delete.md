---
title: delete()
description: Delete rows that match a filter.
---

## Signature

```ts
builder.delete(): this
```

Always chain `.eq()` or another filter — without a filter, `delete()` will attempt to delete every row in the table.

## Examples

```ts
// Delete by ID
const { error } = await massi
  .from('posts')
  .delete()
  .eq('id', postId)

// Delete all drafts for the current user
const { data } = await massi
  .from('posts')
  .delete()
  .eq('draft', true)
  .eq('user_id', userId)
```

## RLS

The row must pass the `USING` clause of any `DELETE` policy for the current user.

## Response

```ts
{
  data:  T[] | null,    // The deleted rows (if return=representation)
  error: MassiError | null,
}
```
