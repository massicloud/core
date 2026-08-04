---
title: مكتبة JavaScript
description: العميل الرسمي لـ MassiCloud بـ JavaScript وTypeScript.
---

`@massicloud/client` هو العميل الرسمي لـ MassiCloud بـ JavaScript وTypeScript. يعمل في المتصفحات وNode.js وReact Native وبيئات edge.

## التثبيت

```bash
npm install @massicloud/client
```

يتطلب Node 18+ لاستخدام `fetch` المدمج.

## مثال بسيط

```ts
import { createClient } from '@massicloud/client'

const massi = createClient({
  url: 'https://api.massicloud.dz/v1/my-project',
  key: 'mc_anon_my-key',
  db:  'production',
})

// تسجيل الدخول
const { data, error } = await massi.auth.signIn({
  email: 'me@example.dz',
  password: 'secret',
})

// استعلام
const { data: todos } = await massi
  .from('todos')
  .select('*')
  .eq('completed', false)
```

## التالي

- [التثبيت](/ar/sdk/javascript/installation)
- [إنشاء عميل](/ar/sdk/javascript/create-client)
- [signUp](/ar/sdk/javascript/auth/sign-up)
- [from()](/ar/sdk/javascript/rest/from)
