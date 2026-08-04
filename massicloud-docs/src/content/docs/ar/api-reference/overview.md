---
title: نظرة عامة على API
description: واجهة HTTP لـ MassiCloud — روابط الأساس والمصادقة والاتفاقيات.
---

واجهة MassiCloud هي واجهة HTTP RESTful. SDK JavaScript هو غلاف رفيع حولها؛ يمكنك استدعاؤها مباشرة من أي لغة.

## URL الأساسي

```
https://api.massicloud.dz/v1/{project-slug}
```

يظهر slug المشروع في البوابة ضمن المشروع ← الإعدادات.

## المصادقة

كل طلب يتطلب رأس `X-MassiCloud-Key`:

```
X-MassiCloud-Key: mc_anon_your_key
```

للطلبات الموثّقة (لاستدعاء RLS كمستخدم محدد)، أضف أيضًا:

```
Authorization: Bearer eyJhbGc...
```

## نوع المحتوى

جميع أجسام الطلبات والاستجابات بتنسيق JSON:

```
Content-Type: application/json
Accept: application/json
```

## شكل الاستجابة

جميع الـ endpoints تُعيد:

```ts
{
  data:  T | null,
  error: { message: string; status: number } | null,
}
```

## الأقسام

- [نقاط نهاية المصادقة](/ar/api-reference/authentication)
- [نقاط نهاية قاعدة البيانات (REST)](/ar/api-reference/database)
- [رموز الأخطاء](/ar/api-reference/errors)
