---
title: from()
description: Démarrez une requête sur une table.
---

## Signature

```ts
massi.from<T>(table: string): QueryBuilder<T>
```

Retourne un `QueryBuilder` chaînable que vous composez avec `.select()`, `.insert()`, `.update()`, ou `.delete()`, ainsi que des filtres et modificateurs, puis `await`.

## Exemple

```ts
const { data, error } = await massi
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10)
```

## Avec TypeScript

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

- `from()` seul n'exécute aucune requête. Vous devez appeler `.select()`, `.insert()`, `.update()`, ou `.delete()` pour spécifier l'opération, puis `await` pour l'exécuter.
- Toutes les méthodes de requête sont chaînables et immuables — chaque appel retourne un nouveau builder, pas le même muté.
