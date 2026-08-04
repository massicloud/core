---
title: signUp()
description: سجّل مستخدمًا جديدًا بالبريد الإلكتروني وكلمة المرور.
---

## التوقيع

```ts
massi.auth.signUp(credentials: { email: string; password: string })
  : Promise<{ data: Session | null; error: MassiError | null }>
```

## مثال

```ts
const { data, error } = await massi.auth.signUp({
  email: 'fatima@example.dz',
  password: 'a-good-password',
})

if (error) {
  console.error(error.message)
  return
}

console.log('المستخدم:', data.user.email)
console.log('التوكن:', data.access_token)
```

## ما الذي يفعله

1. يرسل POST إلى `/auth/signup` بالبريد الإلكتروني وكلمة المرور
2. يشفّر كلمة المرور في الخادم باستخدام bcrypt
3. يُدرج صفًا في جدول `auth.users`
4. يُعيد `Session` مع tokens الوصول والتجديد
5. يحفظ SDK الجلسة إذا كان `persistSession` مفعّلًا

## الاستجابة

عند النجاح:

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

عند الفشل (مثلًا البريد الإلكتروني مستخدَم مسبقًا):

```ts
{
  data: null,
  error: { message: 'user with this email already exists', status: 409 }
}
```

## ملاحظات

- يُحوَّل البريد الإلكتروني إلى أحرف صغيرة قبل التخزين.
- الحد الأدنى لطول كلمة المرور هو 6 أحرف.
- لا توجد خطوة التحقق من البريد الإلكتروني حاليًا — يصبح المستخدمون نشطين فورًا. التحقق من البريد مدرج في خارطة الطريق.
