---
title: Votre première requête
description: Installez le SDK et effectuez votre premier appel à MassiCloud.
---

import { Tabs, TabItem, Aside } from '@astrojs/starlight/components'

<Aside type="caution">
La documentation française est en cours de mise à jour avec les derniers changements de MassiCloud. La version anglaise est à jour : [voir en anglais](/get-started/first-request).
</Aside>

La façon la plus rapide d'utiliser MassiCloud est via le SDK JavaScript. Installons-le et effectuons une requête.

## Installer le SDK

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

## Créer un client

Créez un fichier (ex. `src/lib/massi.js`) :

```js
import { createClient } from '@massicloud/client'

export const massi = createClient({
  url:   'https://api.massicloud.dz/v1/VOTRE-SLUG-PROJET',
  key:   'mc_anon_VOTRE_CLE',
  stage: 'production',
  // db: 'main'  ← optionnel, 'main' par défaut
})
```

Remplacez `VOTRE-SLUG-PROJET` et la clé par les valeurs de votre projet. Vous les trouverez sur la page **Clés API** du portail.

:::caution
Ne committez jamais votre clé anon dans un dépôt public. Utilisez des variables d'environnement :
- Vite : `import.meta.env.VITE_MASSI_KEY`
- Next.js : `process.env.NEXT_PUBLIC_MASSI_KEY`
- Node pur : `process.env.MASSI_KEY`
:::

## Inscrire un utilisateur

```js
import { massi } from './lib/massi'

const { data, error } = await massi.auth.signUp({
  email: 'test@example.dz',
  password: 'un-bon-mot-de-passe',
})

if (error) {
  console.error('Inscription échouée :', error.message)
} else {
  console.log('Inscrit :', data.user.email)
}
```

L'utilisateur est créé dans votre table `auth.users`. Le `data` retourné contient l'enregistrement utilisateur ET un `access_token` pour les requêtes authentifiées.

## Interroger une table

Créons d'abord une table depuis le portail :

1. Allez dans l'explorateur de votre base `main` dans le stage `production`
2. Cliquez sur **Nouvelle table** → nommez-la `notes`
3. Ajoutez les colonnes : `id` (uuid, clé primaire), `title` (text), `user_id` (uuid)
4. Sauvegardez

Depuis votre code :

```js
// Insérer une note
const { data: note } = await massi
  .from('notes')
  .insert({ title: 'Bonjour MassiCloud' })
  .single()

// La relire
const { data: notes } = await massi
  .from('notes')
  .select('*')
  .order('id', { ascending: false })

console.log(notes)
```

C'est fait. Vous venez de créer et d'interroger de vraies données via MassiCloud.

[Voir les prochaines étapes →](/fr/get-started/next-steps)
