import { beforeAll, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { signUpAsEndUser } from "../helpers/end-user"
import type { MassiCloudClient } from "@massicloud/client"

const PUBLIC_BUCKET = "test-public"
const PRIVATE_BUCKET = "test-private"

// Track every object uploaded during this test file's run so the final
// cleanup block can delete them and assert both buckets are empty.
const uploadedKeys: { bucket: string; key: string }[] = []

function trackUpload(bucket: string, key: string) {
    uploadedKeys.push({ bucket, key })
}

// ----- Anon on public bucket -------------------------------------------

describe("Storage: anon on public bucket", () => {
    const massi = makeAnonClient()

    it("lists an empty public bucket", async () => {
        const { data, error } = await massi.storage.from(PUBLIC_BUCKET).list()
        expect(error).toBeNull()
        expect(data).not.toBeNull()
        expect(Array.isArray(data!.objects)).toBe(true)
    })

    it("returns an error for missing object download", async () => {
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .download("definitely-does-not-exist.txt")
        expect(data).toBeNull()
        expect(error).not.toBeNull()
    })
})

// ----- Anon cannot write ----------------------------------------------

describe("Storage: anon cannot write", () => {
    const massi = makeAnonClient()

    it("rejects upload without auth", async () => {
        const blob = new Blob(["hello"], { type: "text/plain" })
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .upload(`anon-attempt-${Date.now()}.txt`, blob)
        expect(data).toBeNull()
        expect(error).not.toBeNull()
    })

    it("rejects delete without auth", async () => {
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .remove("anything.txt")
        expect(data).toBeNull()
        expect(error).not.toBeNull()
    })
})

// ----- End-user round-trip on public bucket ---------------------------

describe("Storage: end-user CRUD on public bucket", () => {
    let massi: MassiCloudClient
    const key = `round-trip-${Date.now()}.txt`
    const content = `hello massicloud at ${Date.now()}`

    beforeAll(async () => {
        massi = await signUpAsEndUser()
    })

    it("uploads a file", async () => {
        const blob = new Blob([content], { type: "text/plain" })
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .upload(key, blob)

        expect(error).toBeNull()
        expect(data).not.toBeNull()
        expect(data!.key).toBe(key)
        expect(data!.size).toBe(content.length)
        trackUpload(PUBLIC_BUCKET, key)
    })

    it("lists the uploaded file", async () => {
        const { data, error } = await massi.storage.from(PUBLIC_BUCKET).list()
        expect(error).toBeNull()
        const keys = data!.objects.map((o) => o.key)
        expect(keys).toContain(key)
    })

    it("downloads and returns the original content", async () => {
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .download(key)
        expect(error).toBeNull()
        expect(data).toBeInstanceOf(Blob)
        const text = await data!.text()
        expect(text).toBe(content)
    })

    it("deletes the file", async () => {
        const { error } = await massi.storage.from(PUBLIC_BUCKET).remove(key)
        expect(error).toBeNull()

        const { data } = await massi.storage.from(PUBLIC_BUCKET).download(key)
        expect(data).toBeNull()
    })
})

// ----- Private bucket behavior ----------------------------------------

describe("Storage: private bucket", () => {
    let owner: MassiCloudClient
    const key = `private-${Date.now()}.txt`
    const content = "private data"

    beforeAll(async () => {
        owner = await signUpAsEndUser()
        const blob = new Blob([content], { type: "text/plain" })
        const { error } = await owner.storage
            .from(PRIVATE_BUCKET)
            .upload(key, blob)
        if (error) throw new Error(`private bucket setup failed: ${error.message}`)
        trackUpload(PRIVATE_BUCKET, key)
    })

    it("owner can download from private bucket", async () => {
        const { data, error } = await owner.storage
            .from(PRIVATE_BUCKET)
            .download(key)
        expect(error).toBeNull()
        expect(await data!.text()).toBe(content)
    })

    it("anon cannot download from private bucket", async () => {
        const anon = makeAnonClient()
        const { data, error } = await anon.storage
            .from(PRIVATE_BUCKET)
            .download(key)
        expect(data).toBeNull()
        expect(error).not.toBeNull()
    })
})

// ----- Presigned URLs -------------------------------------------------

describe("Storage: presigned URLs", () => {
    let massi: MassiCloudClient
    const key = `presigned-${Date.now()}.txt`
    const content = "presigned content"

    beforeAll(async () => {
        massi = await signUpAsEndUser()
        const blob = new Blob([content], { type: "text/plain" })
        const { error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .upload(key, blob)
        if (error) throw new Error(`presign setup failed: ${error.message}`)
        trackUpload(PUBLIC_BUCKET, key)
    })

    it("creates a signed URL with an expiry", async () => {
        const { data, error } = await massi.storage
            .from(PUBLIC_BUCKET)
            .createSignedUrl(key, 60)
        expect(error).toBeNull()
        expect(data).not.toBeNull()
        expect(data!.url).toMatch(/^https?:\/\//)
        expect(data!.expires_at).toBeTruthy()
    })

    it("signed URL is fetchable without auth headers", async () => {
        const { data: signed } = await massi.storage
            .from(PUBLIC_BUCKET)
            .createSignedUrl(key, 60)
        const res = await fetch(signed!.url)
        expect(res.ok).toBe(true)
        const text = await res.text()
        expect(text).toBe(content)
    })
})

// ----- Content types --------------------------------------------------

describe("Storage: content types", () => {
    let massi: MassiCloudClient

    beforeAll(async () => {
        massi = await signUpAsEndUser()
    })

    it("preserves content-type on upload/download round trip", async () => {
        const jsonKey = `types-json-${Date.now()}.json`
        const payload = { hello: "massicloud", ts: Date.now() }
        const jsonBlob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
        })

        const { error: upErr } = await massi.storage
            .from(PUBLIC_BUCKET)
            .upload(jsonKey, jsonBlob)
        expect(upErr).toBeNull()
        trackUpload(PUBLIC_BUCKET, jsonKey)

        const { data: dl } = await massi.storage
            .from(PUBLIC_BUCKET)
            .download(jsonKey)
        expect(dl).not.toBeNull()
        // Some servers/proxies may normalize the type; assert it starts right
        expect(dl!.type).toMatch(/^application\/json/)

        // Cleanup
        await massi.storage.from(PUBLIC_BUCKET).remove(jsonKey)
    })
})

// ----- Cleanup verification -------------------------------------------
// Runs last (Vitest respects file order for top-level describe blocks).
// Deletes every tracked upload and asserts both buckets are empty so no
// debris accumulates across CI runs.

describe("Storage: cleanup", () => {
    let admin: MassiCloudClient

    beforeAll(async () => {
        admin = await signUpAsEndUser()
    })

    it("removes every tracked upload", async () => {
        for (const { bucket, key } of uploadedKeys) {
            // Some may already be deleted by their own tests; that's fine.
            // We don't assert on the result here — the two emptiness
            // checks below are the real assertions.
            await admin.storage.from(bucket).remove(key)
        }
    })

    it("test-public bucket is empty", async () => {
        const { data, error } = await admin.storage
            .from(PUBLIC_BUCKET)
            .list()
        expect(error).toBeNull()
        expect(data!.objects).toEqual([])
    })

    it("test-private bucket is empty", async () => {
        const { data, error } = await admin.storage
            .from(PRIVATE_BUCKET)
            .list()
        expect(error).toBeNull()
        expect(data!.objects).toEqual([])
    })
})
