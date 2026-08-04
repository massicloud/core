---
title: signOut()
description: سجّل خروج المستخدم الحالي وامسح الجلسة.
---

## التوقيع

```ts
massi.auth.signOut(): Promise<{ error: MassiError | null }>
```

## مثال

```ts
const { error } = await massi.auth.signOut()

if (error) {
  console.error('فشل تسجيل الخروج:', error.message)
}
// الجلسة ممسوحة — massi.auth.getUser() يُعيد الآن null
```

## ما الذي يفعله

1. يرسل POST إلى `/auth/logout` لإبطال refresh token في الخادم
2. يحذف الجلسة من التخزين المحلي (أو تخزينك المخصص)
3. يُطلق `onAuthStateChange` مع `SIGNED_OUT`

## ملاحظات

- حتى لو فشل الاستدعاء الشبكي، تُمسح الجلسة المحلية.
- بعد تسجيل الخروج، ستُعيد الاستدعاءات التي تتطلب مصادقة `401` حتى تُسجّل الدخول مجددًا.
