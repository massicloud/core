---
title: select()
description: اقرأ صفوفًا من جدول.
---

## التوقيع

```ts
builder.select(columns?: string): this
```

القيمة الافتراضية لـ `columns` هي `'*'`. مرّر سلسلة مفصولة بفواصل للأعمدة المحددة.

## أمثلة

```ts
// جميع الأعمدة
await massi.from('posts').select('*')

// أعمدة محددة
await massi.from('posts').select('id, title, created_at')

// مع فلاتر
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .order('created_at', { ascending: false })
```

## الاستجابة

```ts
{
  data:  Post[] | null,
  error: MassiError | null,
  count: number | null,
}
```

راجع [الفلاتر](/ar/sdk/javascript/rest/filters) و[المعدّلات](/ar/sdk/javascript/rest/modifiers) للاطّلاع على كامل سطح الاستعلام.
