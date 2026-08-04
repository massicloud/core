---
title: Modifiers
description: Shape the result set with order, limit, offset, single, and count.
---

Modifiers shape the result: ordering, pagination, and response format.

## Reference

| Method                                     | Effect                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| `.order(col, { ascending })`               | Sort results                                             |
| `.limit(n)`                                | Return at most n rows                                    |
| `.range(from, to)`                         | Slice rows by index (0-based, inclusive)                 |
| `.single()`                                | Expect exactly one row — errors if 0 or 2+              |
| `.maybeSingle()`                           | Return one row or null — errors only if 2+               |
| `.count('exact' \| 'planned' \| 'estimated')` | Include row count in response                         |

## Examples

```ts
// Paginate — page 2, 20 items per page
await massi
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .range(20, 39)

// Expect exactly one row
const { data: post, error } = await massi
  .from('posts')
  .select('*')
  .eq('id', postId)
  .single()
// data is Post (not Post[]), error is set if not found

// Count without fetching rows
const { count } = await massi
  .from('posts')
  .select('*', { count: 'exact', head: true })
```

## Notes

- `.single()` sets `Prefer: return=representation` and validates the count. If you get an error like `"JSON object requested, multiple (or no) rows returned"`, your filter isn't specific enough.
- `.range()` sends `Range: from-to` and returns a `206 Partial Content` response. Use it for all paginated UIs.
