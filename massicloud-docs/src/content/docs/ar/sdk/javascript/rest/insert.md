---
title: insert()
description: أدرج صفوفًا في جدول.
---

## التوقيع

```ts
builder.insert(values: Partial<T> | Partial<T>[]): this
```

## أمثلة

```ts
// صف واحد
const { data, error } = await massi
  .from('posts')
  .insert({ title: 'مرحبًا', body: '...' })
  .single()

// صفوف متعددة
const { data } = await massi
  .from('posts')
  .insert([
    { title: 'أ', body: '...' },
    { title: 'ب', body: '...' },
  ])
```

بشكل افتراضي تُعاد الصفوف المُدرجة (يرسل SDK `Prefer: return=representation`).

## RLS

يجب أن يستوفي الإدراج أي سياسة RLS على الجدول تستخدم `WITH CHECK`. الحالة الشائعة: `WITH CHECK (user_id = auth.uid())` — لا تحتاج إلى تعيين `user_id` صراحةً إذا كان له قيمة افتراضية للعمود بـ `auth.uid()`.

## الاستجابة

```ts
{
  data:  T[] | null,    // الصفوف المُدرجة
  error: MassiError | null,
}
```
