---
title: onAuthStateChange()
description: اشترك في تغييرات حالة المصادقة.
---

## التوقيع

```ts
massi.auth.onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { data: { subscription: Subscription } }
```

## مثال

```ts
const { data: { subscription } } = massi.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('المستخدم سجّل الدخول:', session?.user.email)
  }
  if (event === 'SIGNED_OUT') {
    console.log('المستخدم سجّل الخروج')
  }
  if (event === 'TOKEN_REFRESHED') {
    console.log('تم تجديد التوكن')
  }
})

// لاحقًا، إلغاء الاشتراك:
subscription.unsubscribe()
```

## الأحداث

| الحدث             | متى يُطلَق                                       |
| ----------------- | ------------------------------------------------- |
| `SIGNED_IN`       | بعد نجاح `signIn()` أو `signUp()`                |
| `SIGNED_OUT`      | بعد `signOut()` أو إبطال التوكن                  |
| `TOKEN_REFRESHED` | بعد أن يجدّد SDK التوكن تلقائيًا                 |
| `USER_UPDATED`    | بعد تغيير بيانات وصف المستخدم                    |

## ملاحظات

- استدعِ دائمًا `subscription.unsubscribe()` عند إزالة المكوّن (React, Vue, Svelte) لتجنّب تسرّب الذاكرة.
- يُطلَق الـ callback مرة فورية بحالة الجلسة الحالية عند الاشتراك.
