---
title: SDK JavaScript
description: Le client officiel MassiCloud pour JavaScript et TypeScript.
---

`@massicloud/client` est le client officiel MassiCloud pour JavaScript et TypeScript. Il fonctionne dans les navigateurs, Node.js, React Native et les environnements edge.

## Installer

```bash
npm install @massicloud/client
```

Requiert Node 18+ pour le `fetch` natif.

## Exemple minimal

```ts
import { createClient } from '@massicloud/client'

const massi = createClient({
  url: 'https://api.massicloud.dz/v1/mon-projet',
  key: 'mc_anon_ma-cle',
  db:  'production',
})

// Connexion
const { data, error } = await massi.auth.signIn({
  email: 'moi@example.dz',
  password: 'secret',
})

// Requête
const { data: todos } = await massi
  .from('todos')
  .select('*')
  .eq('completed', false)
```

## Suivant

- [Installation](/fr/sdk/javascript/installation)
- [Créer un client](/fr/sdk/javascript/create-client)
- [signUp](/fr/sdk/javascript/auth/sign-up)
- [from()](/fr/sdk/javascript/rest/from)
