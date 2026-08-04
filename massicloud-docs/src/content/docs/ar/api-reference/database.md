---
title: "API قاعدة البيانات (REST)"
description: نقاط نهاية HTTP للاستعلام عن قاعدة بيانات Postgres.
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="caution">
توثيق اللغة العربية قيد التحديث. النسخة الإنجليزية محدثة: [اقرأ بالإنجليزية](/api-reference/database).
</Aside>

واجهة REST للاستعلام عن الجداول تتبع اتفاقيات [PostgREST](https://postgrest.org).

## المسار الأساسي

```
/{stage}/db/{database-name}/rest/{table-name}
```

## GET — تحديد صفوف

```
GET /production/db/main/rest/posts
```

معاملات الاستعلام:

| المعامل    | مثال                             | التأثير                              |
| ---------- | -------------------------------- | ------------------------------------ |
| `select`   | `id,title,created_at`            | الأعمدة المُعادة (الافتراضي: `*`)   |
| `order`    | `created_at.desc`                | عمود الترتيب والاتجاه               |
| `limit`    | `20`                             | الحد الأقصى للصفوف                  |
| `offset`   | `40`                             | تخطّي صفوف (للترقيم)                |
| `{col}`    | `published=eq.true`              | فلتر: `col=op.value`                 |

عوامل الفلتر: `eq`، `neq`، `gt`، `gte`، `lt`، `lte`، `like`، `ilike`، `is`، `in`، `cs`، `cd`.

## POST — إدراج صفوف

```
POST /production/db/main/rest/posts
Content-Type: application/json
Prefer: return=representation

{ "title": "مرحبًا", "body": "..." }
```

مرّر مصفوفة للإدراج المجمّع.

## PATCH — تحديث صفوف

```
PATCH /production/db/main/rest/posts?id=eq.{uuid}
Content-Type: application/json

{ "title": "محدَّث" }
```

أضف دائمًا فلترًا لتجنّب تحديث جميع الصفوف.

## DELETE — حذف صفوف

```
DELETE /production/db/main/rest/posts?id=eq.{uuid}
```

أضف دائمًا فلترًا.
