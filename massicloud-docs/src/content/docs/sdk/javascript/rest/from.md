---
title: from()
description: Begin a query against a table.
---

## Signature

```ts
massi.from<T>(table: string): QueryBuilder<T>
```

Returns a chainable `QueryBuilder` that you compose with `.select()`, `.insert()`, `.update()`, or `.delete()`, plus filters and modifiers, then `await`.

## Example

```ts
const { data, error } = await massi
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10)
```

## With TypeScript

```ts
interface Post {
  id:      string
  title:   string
  body:    string
  user_id: string
}

const { data } = await massi.from<Post>('posts').select('*')
//      ^? data: Post[] | null
```

## Notes

- `from()` alone does not execute any query. You must call `.select()`, `.insert()`, `.update()`, or `.delete()` to specify the operation, then `await` to execute.
- All query methods are chainable and immutable — each call returns a new builder, not the same one mutated.
