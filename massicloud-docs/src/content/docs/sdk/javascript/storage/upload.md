---
title: upload()
description: Upload a file to a bucket.
---

## Signature

```ts
massi.storage.from(bucket: string).upload(
  key: string,
  file: Blob,
  opts?: { contentType?: string }
): Promise<{ data: StorageObject | null; error: MassiCloudError | null }>
```

## Example

```ts
const file = fileInput.files[0] // a Blob/File from an <input type="file">

const { data, error } = await massi.storage
  .from('avatars')
  .upload('users/42/photo.txt', file)
```

## Notes

- Requires a signed-in end user — `massi.auth.signIn()` first. Anonymous uploads are rejected even on public buckets.
- `key` sets the full object path, including any folder-like prefix (`users/42/photo.txt`).
- `opts.contentType` overrides the file's own MIME type if you need to set it explicitly.
