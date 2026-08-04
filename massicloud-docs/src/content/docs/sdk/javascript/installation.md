---
title: Installation
description: Add @massicloud/client to your project.
---

import { Tabs, TabItem } from '@astrojs/starlight/components'

## Package managers

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

## CDN (no bundler)

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@massicloud/client'
  const massi = createClient({ url: '...', key: '...', db: '...' })
</script>
```

## Requirements

| Runtime    | Minimum version | Notes                                    |
| ---------- | --------------- | ---------------------------------------- |
| Node.js    | 18              | Uses built-in `fetch`                    |
| Bun        | 1.0             |                                          |
| Deno       | 1.30            | Import from esm.sh                       |
| Browser    | ES2020          | All modern browsers supported            |
| React Native | 0.73         | Needs `react-native-url-polyfill`        |

## TypeScript

The package ships full TypeScript types with no extra `@types/` package needed. Set `"strict": true` in your `tsconfig.json` for the best experience.

[Create a client →](/sdk/javascript/create-client)
