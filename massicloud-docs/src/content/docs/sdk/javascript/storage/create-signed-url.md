---
title: createSignedUrl()
description: Create a credential-free, time-limited URL for an object.
---

## Signature

```ts
massi.storage.from(bucket: string).createSignedUrl(
  key: string,
  expiresInSeconds?: number // default 3600, max 604800 (7 days)
): Promise<{ data: SignedUrlResponse | null; error: MassiCloudError | null }>
```

```ts
interface SignedUrlResponse {
  url:        string
  expires_at: string
  method:     string
}
```

## Example

```ts
const { data: signed, error } = await massi.storage
  .from('avatars')
  .createSignedUrl('users/42/photo.txt', 3600)

console.log(signed?.url) // safe to share or hotlink — carries no credentials
```

## Notes

- The returned URL is not a presigned MinIO/S3 URL — it's a single-use, expiring token minted by the MassiCloud API, scoped to exactly one bucket/key. See [how signed URLs work](/concepts/object-storage#signed-urls).
- Works for objects in private buckets too, as long as the caller currently has read access at the time the URL is created.
- The URL stops working after `expiresInSeconds`, after which you need to call `createSignedUrl()` again.
