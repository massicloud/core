---
title: أول طلب لك
description: ثبّت SDK وأجرِ أول استدعاء إلى MassiCloud.
---

import { Tabs, TabItem, Aside } from '@astrojs/starlight/components'

<Aside type="caution">
توثيق اللغة العربية قيد التحديث. النسخة الإنجليزية محدثة: [اقرأ بالإنجليزية](/get-started/first-request).
</Aside>

أسرع طريقة لاستخدام MassiCloud هي عبر SDK JavaScript. لنثبّته ونُجري طلبًا.

## تثبيت SDK

<Tabs>
<TabItem label="npm">
```bash
npm install @massicloud/client
```
</TabItem>
<TabItem label="pnpm">
```bash
pnpm add @massicloud/client
```
</TabItem>
<TabItem label="yarn">
```bash
yarn add @massicloud/client
```
</TabItem>
</Tabs>

## إنشاء عميل

أنشئ ملفًا (مثلًا `src/lib/massi.js`):

```js
import { createClient } from '@massicloud/client'

export const massi = createClient({
  url:   'https://api.massicloud.dz/v1/SLUG-مشروعك',
  key:   'mc_anon_مفتاحك',
  stage: 'production',
  // db: 'main'  ← اختياري، الافتراضي 'main'
})
```

استبدل `SLUG-مشروعك` والمفتاح بالقيم من مشروعك. يمكنك إيجادهما في صفحة **مفاتيح API** في البوابة.

:::caution
لا تضغط مفتاح anon أبدًا في مستودع عام. استخدم متغيرات البيئة:
- Vite: `import.meta.env.VITE_MASSI_KEY`
- Next.js: `process.env.NEXT_PUBLIC_MASSI_KEY`
- Node: `process.env.MASSI_KEY`
:::

## تسجيل مستخدم

```js
import { massi } from './lib/massi'

const { data, error } = await massi.auth.signUp({
  email: 'test@example.dz',
  password: 'كلمة-مرور-جيدة',
})

if (error) {
  console.error('فشل التسجيل:', error.message)
} else {
  console.log('مسجّل:', data.user.email)
}
```

سيُنشأ المستخدم في جدول `auth.users`. يحتوي `data` المُعاد على سجل المستخدم و`access_token` للطلبات المصادق عليها.

## الاستعلام عن جدول

لننشئ جدولًا أولًا من البوابة:

1. اذهب إلى مستكشف قاعدة بيانات `main` في stage الـ `production`
2. انقر على **جدول جديد** → سمّه `notes`
3. أضف الأعمدة: `id` (uuid, مفتاح أساسي)، `title` (text)، `user_id` (uuid)
4. احفظ

من كودك الآن:

```js
// إدراج ملاحظة
const { data: note } = await massi
  .from('notes')
  .insert({ title: 'مرحبًا MassiCloud' })
  .single()

// قراءتها
const { data: notes } = await massi
  .from('notes')
  .select('*')
  .order('id', { ascending: false })

console.log(notes)
```

تم. لقد أنشأت بيانات حقيقية واستعلمت عنها عبر MassiCloud.

[ما الخطوات التالية ←](/ar/get-started/next-steps)
