---
title: remove()
description: Delete an object from a bucket.
---

## Signature

```ts
massi.storage.from(bucket: string).remove(
  key: string
): Promise<{ data: null; error: MassiCloudError | null }>
```

## Example

```ts
const { error } = await massi.storage
  .from('avatars')
  .remove('users/42/photo.txt')
```

## Notes

- Requires a signed-in end user, on both public and private buckets.
- There's no bulk delete — call `remove()` once per key, or list first and remove in a loop.
