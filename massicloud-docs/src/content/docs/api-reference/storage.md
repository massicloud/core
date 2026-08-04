---
title: Storage (Buckets) API
description: HTTP endpoints for object storage — list, upload, download, delete, and signed URLs.
---

All storage endpoints are under `/storage/buckets/{bucket}` relative to your project base URL. Reads on public buckets need only the `X-MassiCloud-Key` header; reads on private buckets and all writes also require `Authorization: Bearer <access_token>` for a signed-in end user.

These routes never accept or return MinIO/S3 credentials — see [Object Storage](/concepts/object-storage) for why.

## GET /storage/buckets/{bucket}/objects

List objects in a bucket.

**Query parameters:**

| Parameter  | Example      | Effect                                   |
| ---------- | ------------ | ----------------------------------------- |
| `prefix`   | `users/42/`  | Only return keys under this prefix        |
| `max_keys` | `50`         | Page size (default 100)                   |

**Response (200):**
```json
{
  "objects": [
    { "key": "users/42/photo.txt", "size": 1024, "content_type": "text/plain", "last_modified": "...", "etag": "..." }
  ],
  "folders": ["users/42/"],
  "prefix": "users/",
  "is_truncated": false
}
```

## POST /storage/buckets/{bucket}/objects

Upload an object. Requires a signed-in end user — anonymous writes are never allowed, even to public buckets.

**Headers:** `Authorization: Bearer <access_token>`, `Content-Type: multipart/form-data`

**Form fields:**

| Field  | Required | Description                                  |
| ------ | -------- | --------------------------------------------- |
| `file` | yes      | The file contents                              |
| `key`  | no       | Object key. Defaults to the uploaded filename  |

**Response (201):**
```json
{ "key": "users/42/photo.txt", "size": 1024, "content_type": "text/plain", "last_modified": "...", "etag": "..." }
```

## GET /storage/buckets/{bucket}/objects/{key}

Download an object. `{key}` may contain `/` (e.g. `users/42/photo.txt`).

**Response (200):** raw file bytes, with `Content-Type` and `Content-Disposition` set. Pass `?inline=true` to render in-browser instead of triggering a download.

## DELETE /storage/buckets/{bucket}/objects/{key}

Delete an object. Requires a signed-in end user.

**Response (204):** empty body.

## POST /storage/buckets/{bucket}/presign

Create a credential-free, time-limited signed URL for an object.

**Request body:**
```json
{ "key": "users/42/photo.txt", "expires_in_seconds": 3600 }
```

`expires_in_seconds` defaults to `3600` and is capped at `604800` (7 days).

**Response (200):**
```json
{ "url": "https://api.massicloud.dz/storage/download?token=...", "expires_at": "...", "method": "GET" }
```

The returned `url` is safe to share, hotlink, or embed — it isn't a presigned MinIO URL and carries no credentials, just a single-use, expiring token scoped to one object.
