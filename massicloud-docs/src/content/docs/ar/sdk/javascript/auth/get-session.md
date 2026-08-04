---
title: getSession()
description: احصل على الجلسة الحالية من التخزين المحلي دون استدعاء شبكي.
---

## التوقيع

```ts
massi.auth.getSession(): Promise<{ data: { session: Session | null }; error: MassiError | null }>
```

## مثال

```ts
const { data: { session } } = await massi.auth.getSession()

if (session) {
  console.log('توكن الوصول:', session.access_token)
  console.log('ينتهي في:', new Date(session.expires_at * 1000))
}
```

## ملاحظات

- يقرأ من التخزين المحلي — لا استدعاء شبكي.
- قد يكون التوكن منتهي الصلاحية؛ يجدّده SDK إذا كان `autoRefreshToken` مفعّلًا (الافتراضي).
- فضّل [`getUser()`](/ar/sdk/javascript/auth/get-user) عندما تحتاج إلى التحقق من التوكن في الخادم.
