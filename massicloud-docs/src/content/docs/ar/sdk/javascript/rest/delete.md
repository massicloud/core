---
title: delete()
description: احذف الصفوف المطابقة لفلتر.
---

## التوقيع

```ts
builder.delete(): this
```

سلسل دائمًا `.eq()` أو فلترًا آخر — بدون فلتر، ستحاول `delete()` حذف كل صف في الجدول.

## أمثلة

```ts
// حذف بالمعرّف
const { error } = await massi
  .from('posts')
  .delete()
  .eq('id', postId)

// حذف جميع المسوّدات للمستخدم الحالي
const { data } = await massi
  .from('posts')
  .delete()
  .eq('draft', true)
  .eq('user_id', userId)
```

## RLS

يجب أن يجتاز الصف شرط `USING` في أي سياسة `DELETE` للمستخدم الحالي.

## الاستجابة

```ts
{
  data:  T[] | null,    // الصفوف المحذوفة (إذا كان return=representation)
  error: MassiError | null,
}
```
