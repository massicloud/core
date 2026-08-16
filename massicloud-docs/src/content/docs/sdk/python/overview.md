---
title: Python SDK
description: The MassiCloud client for Python — coming soon.
---

import { Badge } from '@astrojs/starlight/components'

<Badge text="Coming soon" variant="caution" size="large" />

The official Python SDK for MassiCloud is under development. It will support:

- Authentication
- Postgres queries via a fluent query builder
- Async support (asyncio)
- Type hints throughout

## In the meantime

You can use MassiCloud from Python today via direct HTTP calls. The API is RESTful and documented in the [API Reference](/api-reference/overview).

```python
import httpx

headers = {
    "X-MassiCloud-Key": "mc_anon_your_key",
    "Authorization": f"Bearer {access_token}",  # if authenticated
}

resp = httpx.get(
    "https://api.massicloud.dz/v1/my-project/db/production/rest/posts",
    headers=headers,
)
print(resp.json())
```

Email support@massicloud.dz to be notified when the Python SDK is ready.
