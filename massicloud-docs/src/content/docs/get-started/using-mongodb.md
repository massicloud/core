---
title: Using MongoDB
description: Add a MongoDB instance to a stage, get its connection string, and connect from your app.
---

import { Steps } from '@astrojs/starlight/components'

See [MongoDB](/concepts/mongodb/) for how this fits into MassiCloud's model — no REST proxy, no SDK wrapper, you connect with the native driver.

## Add a MongoDB instance

<Steps>

1. **Open your project's stage, then "Add database"**

   From the portal: `Projects → your project → Stages → (a stage) → Add database`.

2. **Choose "MongoDB" as the type**

   Set a name, memory, and storage size. Optionally pick a schema preset (a `users` collection with a unique email index, or a blog starter with `posts`/`comments`) — or leave it blank.

3. **Click "Add database"**

   MongoDB takes a bit longer to boot than Postgres or Redis — allow up to a couple of minutes for the instance to become ready.

</Steps>

## Get the connection string

Open the instance from the sidebar (or `MongoDB` in the main nav). You'll see two connection strings, both masked by default with a reveal/copy button:

- **Service** — read/write, use this from your backend
- **Readonly** — read-only, use this for reporting/analytics workloads

## Connect and insert a document

```bash
npm install mongodb
```

```ts
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGO_URL!) // paste the "Service" string
await client.connect()

const db = client.db('appdb')
await db.collection('users').insertOne({ email: 'user@example.com', name: 'Test User' })
```

## View it in the portal

Back in the portal, open the instance's **Documents** tab and select the collection — the document you just inserted shows up there. You can also edit or delete it directly from the grid, or open the **Query** tab to run `find`/`aggregate`/`count` queries against your data without leaving the browser.
