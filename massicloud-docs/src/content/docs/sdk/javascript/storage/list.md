---
title: list()
description: List objects in a bucket.
---

## Signature

```ts
massi.storage.from(bucket: string).list(
  prefix?: string,
  opts?: { limit?: number }
): Promise<{ data: ListObjectsResult | null; error: MassiCloudError | null }>
```

```ts
interface ListObjectsResult {
  objects: { key: string; size: number; content_type: string; last_modified: string; etag: string }[]
  folders: string[]
  prefix: string
  is_truncated: boolean
}
```

## Example

```ts
const { data, error } = await massi.storage
  .from('avatars')
  .list('users/42/')

if (data) {
  for (const obj of data.objects) {
    console.log(obj.key, obj.size)
  }
}
```

## Notes

- `prefix` filters to keys under that path; omit it to list the whole bucket.
- `opts.limit` sets the page size (defaults to 100 on the server).
- Works with just the anon key on public buckets. Private buckets require a signed-in end user.
