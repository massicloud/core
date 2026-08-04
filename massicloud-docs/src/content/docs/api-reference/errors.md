---
title: Errors
description: HTTP status codes and error response shapes.
---

All error responses follow the same shape:

```json
{
  "data": null,
  "error": {
    "message": "human-readable description",
    "status":  400
  }
}
```

## Common status codes

| Status | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| 400    | Bad request — malformed JSON, missing required field                        |
| 401    | Unauthorized — missing or invalid key / JWT                                 |
| 403    | Forbidden — valid credentials but RLS denied the operation                  |
| 404    | Not found — table or resource doesn't exist                                 |
| 409    | Conflict — unique constraint violation (e.g. duplicate email on signup)     |
| 422    | Unprocessable — validation error (e.g. password too short)                  |
| 500    | Internal server error — something went wrong on our end; check status page  |

## RLS errors

When an operation is blocked by RLS, you'll get a `403` with:

```json
{ "error": { "message": "row-level security policy violation", "status": 403 } }
```

Check that:

1. The table has an appropriate policy for the requesting role
2. You're sending the `Authorization: Bearer` header when making authenticated requests
3. The `auth.uid()` in the policy matches the user's actual ID

## Debugging tips

- A `403` on `.select()` usually means no SELECT policy exists for `anon`.
- A `403` on `.insert()` usually means the `WITH CHECK` clause fails.
- An empty `data: []` (not an error) means the query ran but RLS filtered all rows.
