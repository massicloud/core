---
title: Your first request
description: Install the SDK and make your first call to MassiCloud.
---

import { Tabs, TabItem } from '@astrojs/starlight/components'

The fastest way to use MassiCloud is via the JavaScript SDK. Let's install it and make a request.

## Install the SDK

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

## Create a client

Create a file (e.g. `src/lib/massi.js`):

```js
import { createClient } from '@massicloud/client'

export const massi = createClient({
  url:   'https://api.massicloud.dz/v1/YOUR-PROJECT-SLUG',
  key:   'mc_anon_YOUR_KEY_HERE',
  stage: 'production',
  // db: 'main'  ← optional, defaults to 'main'
})
```

Replace `YOUR-PROJECT-SLUG` and the key with values from your project. You can find both on the **API Keys** page in the portal.

> The `stage` field tells MassiCloud which environment to talk to.
> The `db` field is optional — it defaults to 'main', which is the database name auto-created with your project.
> If you've added more databases to your stage, use `db: 'other-name'` here, or switch ad-hoc with `massi.db('other-name')`.

:::caution
Never commit your anon key to a public repo. Use environment variables:
- Vite: `import.meta.env.VITE_MASSI_KEY`
- Next.js: `process.env.NEXT_PUBLIC_MASSI_KEY`
- Plain Node: `process.env.MASSI_KEY`
:::

## Sign up a user

```js
import { massi } from './lib/massi'

const { data, error } = await massi.auth.signUp({
  email: 'test@example.dz',
  password: 'something-secure',
})

if (error) {
  console.error('Sign up failed:', error.message)
} else {
  console.log('Signed up:', data.user.email)
}
```

Run this and the user is created in your `auth.users` table. The returned `data` contains the user record AND an `access_token` you can use to make authenticated requests.

## Query a table

Let's create a table from the portal first:

1. Go to the explorer for your `main` database in the `production` stage
2. Click **New table** → name it `notes`
3. Add columns: `id` (uuid, primary key), `title` (text), `user_id` (uuid)
4. Save

Now from your code:

```js
// Insert a note
const { data: note } = await massi
  .from('notes')
  .insert({ title: 'Hello MassiCloud' })
  .single()

// Read it back
const { data: notes } = await massi
  .from('notes')
  .select('*')
  .order('id', { ascending: false })

console.log(notes)
```

Done. You've just created and queried real data through MassiCloud.

[See what's next →](/get-started/next-steps)
