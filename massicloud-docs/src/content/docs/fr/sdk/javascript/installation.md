---
title: Installation
description: Ajoutez @massicloud/client à votre projet.
---

import { Tabs, TabItem } from '@astrojs/starlight/components'

## Gestionnaires de paquets

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

## CDN (sans bundler)

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@massicloud/client'
  const massi = createClient({ url: '...', key: '...', db: '...' })
</script>
```

## Prérequis

| Environnement | Version minimale | Notes                                   |
| ------------- | ---------------- | --------------------------------------- |
| Node.js       | 18               | Utilise `fetch` natif                   |
| Bun           | 1.0              |                                         |
| Deno          | 1.30             | Import via esm.sh                       |
| Navigateur    | ES2020           | Tous les navigateurs modernes           |
| React Native  | 0.73             | Nécessite `react-native-url-polyfill`   |

## TypeScript

Le paquet inclut des types TypeScript complets sans `@types/` supplémentaire. Définissez `"strict": true` dans votre `tsconfig.json` pour la meilleure expérience.

[Créer un client →](/fr/sdk/javascript/create-client)
