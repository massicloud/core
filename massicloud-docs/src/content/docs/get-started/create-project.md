---
title: Create a project
description: How to create your first MassiCloud project.
---

import { Steps } from '@astrojs/starlight/components'

## Create your first project

Projects in MassiCloud are containers for everything in one app:
its databases, its storage buckets, its API keys, its end-users.

<Steps>

1. **From your dashboard, click "New project"**

2. **Give it a name**

   Pick something descriptive. The slug is auto-generated from the name and used in API URLs.

3. **Click "Create"**

   MassiCloud creates the project AND automatically sets up:
   - Two API keys (anon + service)
   - A "production" stage
   - A Postgres database named "main" in that stage, pre-configured with the auth schema

   **Save both keys when shown — they're only displayed once.**
   - **Anon key** (`mc_anon_...`) — safe to ship in browser code
   - **Service key** (`mc_service_...`) — secret, server-side only

</Steps>

## What's a stage?

A **stage** is an isolated environment. MassiCloud creates a "production" stage by default. As you grow, you can add more — "staging" for testing, "development" for experiments.

Each stage has its own databases. Each stage's URLs are separate:

```
/v1/{project-slug}/production/db/main/rest/{table}
/v1/{project-slug}/staging/db/main/rest/{table}
```

That means signing up a user against `production` doesn't create that user in `staging`. They're real environments, not just labels.

You'll mostly work with the default "production" stage at first. Adding more is one click in the portal.

[Make your first request →](/get-started/first-request)
