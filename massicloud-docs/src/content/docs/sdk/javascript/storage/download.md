---
title: download()
description: Download an object's bytes.
---

## Signature

```ts
massi.storage.from(bucket: string).download(
  key: string
): Promise<{ data: Blob | null; error: MassiCloudError | null }>
```

## Example

```ts
const { data: blob, error } = await massi.storage
  .from('avatars')
  .download('users/42/photo.txt')

if (blob) {
  const url = URL.createObjectURL(blob)
}
```

## Notes

- Returns a `Blob`, ready to render with `URL.createObjectURL()` or save with the File System Access API.
- Public buckets need only the anon key. Private buckets require a signed-in end user.
- For links you want to share or hotlink without re-fetching through your app, use [createSignedUrl()](/sdk/javascript/storage/create-signed-url) instead.
