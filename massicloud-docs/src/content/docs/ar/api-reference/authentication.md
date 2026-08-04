---
title: API المصادقة
description: نقاط نهاية HTTP لمصادقة المستخدمين.
---

جميع نقاط نهاية المصادقة تحت `/auth` نسبةً إلى URL الأساسي لمشروعك.

## POST /auth/signup

تسجيل مستخدم جديد.

**جسم الطلب:**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**الاستجابة (201):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.dz", "created_at": "..." },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_at": 1718284800,
    "token_type": "Bearer"
  },
  "error": null
}
```

## POST /auth/login

تسجيل دخول مستخدم موجود.

**جسم الطلب:**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**الاستجابة (200):** نفس هيكل signup.

## POST /auth/logout

إبطال refresh token الحالي.

**الرؤوس:** يتطلب `Authorization: Bearer <access_token>`

**الاستجابة (200):**
```json
{ "data": null, "error": null }
```

## POST /auth/refresh

استبدال refresh token بـ access token جديد.

**جسم الطلب:**
```json
{ "refresh_token": "eyJ..." }
```

**الاستجابة (200):** نفس هيكل login.

## GET /auth/user

الحصول على المستخدم المصادَق عليه حاليًا.

**الرؤوس:** يتطلب `Authorization: Bearer <access_token>`

**الاستجابة (200):**
```json
{
  "data": { "user": { "id": "...", "email": "...", "created_at": "..." } },
  "error": null
}
```
