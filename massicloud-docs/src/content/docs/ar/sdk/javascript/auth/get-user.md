---
title: getUser()
description: احصل على المستخدم المسجّل دخوله حاليًا.
---

## التوقيع

```ts
massi.auth.getUser(): Promise<{ data: { user: User | null }; error: MassiError | null }>
```

## مثال

```ts
const { data: { user }, error } = await massi.auth.getUser()

if (!user) {
  console.log('غير مسجّل الدخول')
} else {
  console.log('مسجّل الدخول بوصفه:', user.email)
}
```

## ملاحظات

- يُعيد `null` للـ `user` إذا لم تكن هناك جلسة نشطة.
- يتصل هذا الاستدعاء بالخادم للتحقق من صحة التوكن — استخدم [`getSession()`](/ar/sdk/javascript/auth/get-session) للقراءة المحلية التي تتجنب ذهابًا وإيابًا عبر الشبكة.
