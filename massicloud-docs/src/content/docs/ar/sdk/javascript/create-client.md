---
title: createClient()
description: أنشئ نسخة عميل MassiCloud.
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="caution">
توثيق اللغة العربية قيد التحديث. النسخة الإنجليزية محدثة: [اقرأ بالإنجليزية](/sdk/javascript/create-client).
</Aside>

تقوم `createClient(config)` ببناء العميل المستخدَم لجميع الاستدعاءات.

## التوقيع

```ts
createClient(config: MassiCloudConfig): MassiCloudClient
```

## المعاملات

```ts
interface MassiCloudConfig {
  url:      string                      // مطلوب. URL الأساسي مع slug المشروع.
  key:      string                      // مطلوب. مفتاح anon أو service.
  stage:    string                      // مطلوب. مثل 'production'، 'staging'.
  db?:      string                      // اختياري. الافتراضي: 'main'.
  auth?:    AuthConfig                  // اختياري. خيارات استمرارية الجلسة.
  fetch?:   typeof fetch                // اختياري. تطبيق fetch مخصص.
  headers?: Record<string, string>      // اختياري. رؤوس تُضاف لكل طلب.
}
```

## أمثلة

### المتصفح (الافتراضي)

```ts
const massi = createClient({
  url:   'https://api.massicloud.dz/v1/my-project',
  key:   import.meta.env.VITE_MASSI_KEY,
  stage: 'production',
})
// الجلسات مستمرة في localStorage، تجديد تلقائي.
```

### الخادم (Node)

```ts
const massi = createClient({
  url:   process.env.MASSI_URL!,
  key:   process.env.MASSI_SERVICE_KEY!,  // مفتاح الخدمة — يتجاوز RLS
  stage: 'production',
  auth:  { persistSession: false },
})
```

### React Native مع AsyncStorage

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const massi = createClient({
  url:   '...',
  key:   '...',
  stage: 'production',
  auth: {
    storage: AsyncStorage,
    persistSession: true,
  },
})
```

### مراحل متعددة

عميل واحد لكل مرحلة:

```ts
const prod = createClient({ url, key, stage: 'production' })
const stg  = createClient({ url, key, stage: 'staging' })
```

### قواعد بيانات متعددة في نفس المرحلة

الـ `db` الافتراضية هي `'main'`. بدّل بشكل مؤقت مع `.db(name)`:

```ts
const massi = createClient({ url, key, stage: 'production' })

// قاعدة البيانات الافتراضية ('main')
await massi.from('users').select()

// قاعدة بيانات مختلفة في نفس المرحلة
await massi.db('analytics').from('events').select()
```
