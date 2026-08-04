---
title: التثبيت
description: أضف @massicloud/client إلى مشروعك.
---

import { Tabs, TabItem } from '@astrojs/starlight/components'

## مديرو الحزم

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
<TabItem label="bun">
```bash
bun add @massicloud/client
```
</TabItem>
</Tabs>

## CDN (بدون bundler)

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@massicloud/client'
  const massi = createClient({ url: '...', key: '...', db: '...' })
</script>
```

## المتطلبات

| البيئة       | الحد الأدنى للإصدار | ملاحظات                                |
| ------------ | ------------------- | -------------------------------------- |
| Node.js      | 18                  | يستخدم `fetch` المدمج                  |
| Bun          | 1.0                 |                                        |
| Deno         | 1.30                | استيراد عبر esm.sh                     |
| المتصفح      | ES2020              | جميع المتصفحات الحديثة مدعومة          |
| React Native | 0.73                | يتطلب `react-native-url-polyfill`      |

## TypeScript

تأتي الحزمة مع أنواع TypeScript كاملة دون الحاجة إلى `@types/` إضافية. عيّن `"strict": true` في `tsconfig.json` للحصول على أفضل تجربة.

[إنشاء عميل ←](/ar/sdk/javascript/create-client)
