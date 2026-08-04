---
title: update()
description: حدّث الصفوف المطابقة لفلتر.
---

## التوقيع

```ts
builder.update(values: Partial<T>): this
```

سلسل دائمًا `.eq()` أو فلترًا آخر — بدون فلتر، ستحاول `update()` تحديث كل صف في الجدول.

## أمثلة

```ts
// تحديث صف واحد بالمعرّف
const { data, error } = await massi
  .from('posts')
  .update({ title: 'عنوان محدَّث' })
  .eq('id', postId)
  .single()

// تحديث صفوف متعددة
const { data } = await massi
  .from('posts')
  .update({ published: true })
  .eq('draft', false)
```

## RLS

يجب أن يستوفي التحديث:

- `USING` — يجب أن يطابق الصف السياسة لكي يتمكن المستخدم الحالي من رؤيته
- `WITH CHECK` — يجب أن يستوفي الصف المحدَّث السياسة بعد التعديل

## الاستجابة

```ts
{
  data:  T[] | null,    // الصفوف المحدَّثة
  error: MassiError | null,
}
```
