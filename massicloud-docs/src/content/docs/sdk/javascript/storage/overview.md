---
title: Storage overview
description: The storage client for buckets and objects.
---

`massi.storage` gives you list/upload/download/delete/signed-URL methods against the [mediated storage API](/concepts/object-storage) — no MinIO/S3 credentials are ever involved on the client side.

Unlike `massi.from()`, storage isn't scoped to a database — buckets belong to the project, not to any one `db`/`stage` combination.

## Signature

```ts
massi.storage.from(bucket: string): StorageBucketApi
```

Returns a `StorageBucketApi` scoped to one bucket, with `.list()`, `.upload()`, `.download()`, `.remove()`, and `.createSignedUrl()`.

## Example

```ts
const { data, error } = await massi.storage
  .from('avatars')
  .upload('users/42/photo.txt', file)
```

## Methods

- [list()](/sdk/javascript/storage/list)
- [upload()](/sdk/javascript/storage/upload)
- [download()](/sdk/javascript/storage/download)
- [createSignedUrl()](/sdk/javascript/storage/create-signed-url)
- [remove()](/sdk/javascript/storage/remove)
