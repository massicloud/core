---
title: الفلاتر
description: فلتر الصفوف باستخدام eq وneq وgt وlt وlike وin والمزيد.
---

تُضيّق الفلاتر الصفوف التي تُعاد عبر `.select()`، أو تُحدَّث عبر `.update()`، أو تُحذف عبر `.delete()`. سلسل بقدر ما تحتاج.

## المرجع

كل فلتر أدناه يعمل مع Postgres. راجع ملاحظات التوافق أسفله لمعرفة ما يختلف
عندما تكون قاعدة البيانات [MySQL](/ar/concepts/mysql) — فخدمة mysql-rest
الخاصة بها تُنفّذ مجموعة فرعية أصغر ومتوافقة مع PostgREST. الفلاتر غير
المدعومة لا يتم تجاهلها بصمت أبدًا: تُعيد mysql-rest خطأ `400` يوضّح ما لم
تفهمه.

| الدالة                          | المكافئ في SQL                    |
| ------------------------------- | --------------------------------- |
| `.eq('col', value)`             | `col = value`                     |
| `.neq('col', value)`            | `col != value`                    |
| `.gt('col', value)`             | `col > value`                     |
| `.gte('col', value)`            | `col >= value`                    |
| `.lt('col', value)`             | `col < value`                     |
| `.lte('col', value)`            | `col <= value`                    |
| `.like('col', pattern)`         | `col LIKE pattern`                |
| `.ilike('col', pattern)`        | `col ILIKE pattern`               |
| `.is('col', null)`              | `col IS NULL`                     |
| `.in('col', [a, b])`            | `col IN (a, b)`                   |
| `.contains('col', [a])`         | `col @> ARRAY[a]` (عمود مصفوفة)  |
| `.containedBy('col', [a, b])`   | `col <@ ARRAY[a, b]`              |
| `.filter('col', 'op', value)`   | منفذ هروب للعمليات التعسفية      |

**على MySQL:** تعمل جميعها: `.eq`، `.neq`، `.gt`، `.gte`، `.lt`، `.lte`،
`.like`، `.is`، و`.in`. لا يملك `.ilike` معادلًا غير حساس لحالة الأحرف —
استخدم `.like()` (ترتيب المطابقة الافتراضي في MySQL غير حساس لحالة الأحرف
أصلًا لمعظم أعمدة النص). `.contains` / `.containedBy` عمليات مصفوفة خاصة
بـ Postgres وغير متاحة. `.filter()` يتعرّف فقط على العمليات في الجدول أعلاه،
وليس صيغة PostgREST خام تعسفية.

## أمثلة

```ts
// المساواة
await massi.from('users').select('*').eq('role', 'admin')

// نطاق
await massi.from('orders').select('*').gte('total', 1000).lt('total', 5000)

// مطابقة نمط (غير حساسة لحالة الأحرف)
await massi.from('products').select('*').ilike('name', '%phone%')

// فحص null
await massi.from('posts').select('*').is('deleted_at', null)

// ضمن مجموعة
await massi.from('posts').select('*').in('status', ['draft', 'review'])

// فلاتر متعددة (AND)
await massi
  .from('posts')
  .select('*')
  .eq('published', true)
  .gte('created_at', '2025-01-01')
  .order('created_at', { ascending: false })
```

جميع الفلاتر تُجمع بـ AND. استعلامات OR تتطلب منفذ الهروب `.filter()` مع صيغة PostgREST الخام أو view في Postgres.
