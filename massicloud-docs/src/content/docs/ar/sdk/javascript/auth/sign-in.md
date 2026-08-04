---
title: signIn()
description: سجّل دخول مستخدم موجود بالبريد الإلكتروني وكلمة المرور.
---

## التوقيع

```ts
massi.auth.signIn(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## مثال

```ts
const { data, error } = await massi.auth.signIn({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error('فشل تسجيل الدخول:', error.message)
  return
}

console.log('أهلًا بعودتك،', data.user.email)
```

## الاستجابة

نفس هيكل [`signUp`](/ar/sdk/javascript/auth/sign-up#الاستجابة):

```ts
{
  data: {
    user:          { id, email, created_at, ... },
    access_token:  'eyJhbGc...',
    refresh_token: 'eyJhbGc...',
    expires_at:    1718284800,
    token_type:    'Bearer'
  },
  error: null
}
```

عند الفشل (كلمة مرور خاطئة أو مستخدم غير موجود):

```ts
{
  data: null,
  error: { message: 'invalid email or password', status: 401 }
}
```

## ملاحظات

- يحفظ SDK الجلسة تلقائيًا إذا كان `persistSession` مفعّلًا (الافتراضي في المتصفحات).
- يصلح token الوصول بعد ساعة. يجدّده SDK تلقائيًا عبر refresh token.
- لمعرفة المستخدم المسجّل دخوله في أي وقت، استدعِ [`getUser()`](/ar/sdk/javascript/auth/get-user).
