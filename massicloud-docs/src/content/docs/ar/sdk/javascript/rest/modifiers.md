---
title: المعدّلات
description: شكّل مجموعة النتائج باستخدام order وlimit وoffset وsingle وcount.
---

المعدّلات تُشكّل النتيجة: الترتيب والترقيم وتنسيق الاستجابة.

## المرجع

| الدالة                                        | التأثير                                               |
| --------------------------------------------- | ----------------------------------------------------- |
| `.order(col, { ascending })`                  | ترتيب النتائج                                         |
| `.limit(n)`                                   | إعادة ما يصل إلى n صف                                 |
| `.range(from, to)`                            | تقطيع الصفوف بالمؤشر (يبدأ من 0، شامل)               |
| `.single()`                                   | توقّع صف واحد بالضبط — خطأ إذا كانت 0 أو 2+          |
| `.maybeSingle()`                              | إعادة صف واحد أو null — خطأ فقط إذا كانت 2+          |
| `.count('exact' \| 'planned' \| 'estimated')` | تضمين عدد الصفوف في الاستجابة                         |

## أمثلة

```ts
// ترقيم — الصفحة 2، 20 عنصرًا لكل صفحة
await massi
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .range(20, 39)

// توقّع صف واحد بالضبط
const { data: post, error } = await massi
  .from('posts')
  .select('*')
  .eq('id', postId)
  .single()
// data هو Post (ليس Post[])، error مُعيَّن إذا لم يُوجد

// العدّ دون جلب الصفوف
const { count } = await massi
  .from('posts')
  .select('*', { count: 'exact', head: true })
```

## ملاحظات

- تضبط `.single()` الـ `Prefer: return=representation` وتتحقق من العدد. إذا ظهر خطأ مثل `"JSON object requested, multiple (or no) rows returned"`، فالفلتر ليس محددًا بما يكفي.
- تُرسل `.range()` `Range: from-to` وتُعيد استجابة `206 Partial Content`. استخدمها لجميع واجهات المستخدم المُرقَّمة.
