---
title: from()
description: ابدأ استعلامًا على جدول.
---

## التوقيع

```ts
massi.from<T>(table: string): QueryBuilder<T>
```

يُعيد `QueryBuilder` قابلًا للتسلسل تُركّبه مع `.select()` أو `.insert()` أو `.update()` أو `.delete()`، مع الفلاتر والمعدّلات، ثم `await`.

## مثال

```ts
const { data, error } = await massi
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10)
```

## مع TypeScript

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

## ملاحظات

- `from()` وحده لا ينفّذ أي استعلام. يجب استدعاء `.select()` أو `.insert()` أو `.update()` أو `.delete()` لتحديد العملية، ثم `await` لتنفيذها.
- جميع طرق الاستعلام قابلة للتسلسل وغير متغيّرة — كل استدعاء يُعيد builder جديدًا، ليس نفس الكائن معدّلًا.
