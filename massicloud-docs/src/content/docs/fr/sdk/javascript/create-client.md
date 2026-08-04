---
title: createClient()
description: Créez une instance du client MassiCloud.
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="caution">
La documentation française est en cours de mise à jour avec les derniers changements de MassiCloud. La version anglaise est à jour : [voir en anglais](/sdk/javascript/create-client).
</Aside>

`createClient(config)` construit le client utilisé pour tous les appels.

## Signature

```ts
createClient(config: MassiCloudConfig): MassiCloudClient
```

## Paramètres

```ts
interface MassiCloudConfig {
  url:      string                      // Requis. URL de base avec le slug du projet.
  key:      string                      // Requis. Clé anon ou service.
  stage:    string                      // Requis. Ex. 'production', 'staging'.
  db?:      string                      // Optionnel. Défaut : 'main'.
  auth?:    AuthConfig                  // Optionnel. Options de persistance de session.
  fetch?:   typeof fetch                // Optionnel. Implémentation fetch personnalisée.
  headers?: Record<string, string>      // Optionnel. En-têtes ajoutés à chaque requête.
}
```

## Exemples

### Navigateur (défaut)

```ts
const massi = createClient({
  url:   'https://api.massicloud.dz/v1/my-project',
  key:   import.meta.env.VITE_MASSI_KEY,
  stage: 'production',
})
// Sessions persistées dans localStorage, rafraîchissement automatique.
```

### Côté serveur Node

```ts
const massi = createClient({
  url:   process.env.MASSI_URL!,
  key:   process.env.MASSI_SERVICE_KEY!,  // Clé service — contourne RLS
  stage: 'production',
  auth:  { persistSession: false },
})
```

### React Native avec AsyncStorage

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

### Stages multiples

Un client par stage :

```ts
const prod = createClient({ url, key, stage: 'production' })
const stg  = createClient({ url, key, stage: 'staging' })
```

### Bases de données multiples dans le même stage

La `db` par défaut est `'main'`. Changez à la volée avec `.db(name)` :

```ts
const massi = createClient({ url, key, stage: 'production' })

// Base par défaut ('main')
await massi.from('users').select()

// Une autre base dans le même stage
await massi.db('analytics').from('events').select()
```
