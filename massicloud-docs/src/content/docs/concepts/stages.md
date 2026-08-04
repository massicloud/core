---
title: Stages
description: Stages are isolated environments for your project's databases and services.
---

A **stage** in MassiCloud is an isolated environment for the databases and services in a project. Most teams use stages to separate production data from staging or development data.

## The default stage

Every project gets a stage named `production` automatically when it's created. Inside that stage, there's a Postgres database named `main` configured with the auth schema.

If you only need one environment, you can stop here. The default setup is everything you need for a simple app.

## Adding more stages

Click "Stages" in your project's sidebar to add more. Common patterns:

- `production` + `staging` — two environments, deploy to staging first, promote to production
- `production` + `staging` + `development` — full three-tier
- `production` + `previews/{branch-name}` — preview environments per PR (not automated yet, but doable manually)

## How stages affect URLs

Every API URL includes the stage:

```
/v1/{project-slug}/{stage}/db/{db-name}/rest/{table}
/v1/{project-slug}/{stage}/db/{db-name}/auth/signup
```

This means:

- A user who signs up against `production` does **not** exist in `staging`. They're separate database environments.
- API keys work across all stages of the same project (no need for separate keys per environment).
- Each stage's database can have completely different schemas, tables, and policies.

## Multiple databases in a stage

A stage can hold many database instances — for example, a Postgres for relational data, a [MySQL](/concepts/mysql) database for a ported app, plus a Redis for caching. Add databases to an existing stage via the Stages page.

The SDK lets you switch databases within a stage:

```ts
const massi = createClient({ 
  url, key, stage: 'production'
  // db defaults to 'main'
})

await massi.from('users').select()           // 'main' db
await massi.db('analytics').from('events')   // different db
```

## Protected stages

Mark a stage as **protected** to prevent accidental deletion. You can toggle protection on and off from the stage card.

We recommend protecting `production` always. The portal will warn you twice and require typing the stage name before deletion, but protection adds an extra guardrail.
