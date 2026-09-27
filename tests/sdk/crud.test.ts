import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { makeAnonClient, makeServiceClient } from "../helpers/client"
import { resetAudit } from "../helpers/admin"
import { resetSeed } from "../helpers/setup"
import { uniqueEmail } from "../helpers/random"

// The SDK's QueryBuilder<T> types `data` as `T` even though every method
// except .single()/.maybeSingle() actually returns an array at runtime (see
// its own tests, which never pass a type param for exactly this reason —
// tests/rest.test.ts in massicloud-js). Rather than fight that, we leave
// `.from()` untyped and cast to the shape we expect once we have a value.
interface Customer {
  id: number
  name: string
  email: string
  country: string
}

const massi = makeAnonClient()
const admin = makeServiceClient()

describe("CRUD", () => {
  beforeEach(() => resetSeed("customers"))

  it("inserts and returns the row", async () => {
    const { data, error } = await massi.from("customers").insert({
      name: "Test User",
      email: uniqueEmail(),
      country: "DZ",
    })
    const rows = data as Customer[]

    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBeGreaterThan(0)
  })

  it("selects all seeded rows", async () => {
    const { data, error } = await massi.from("customers").select()
    expect(error).toBeNull()
    expect(data as Customer[]).toHaveLength(3)
  })

  it("selects a single row with .single()", async () => {
    const { data: all } = await massi.from("customers").select().limit(1)
    const id = (all as Customer[])[0].id

    const { data, error } = await massi.from("customers").select().eq("id", id).single()

    expect(error).toBeNull()
    expect((data as Customer).id).toBe(id)
  })

  it("updates and returns the row", async () => {
    const { data } = await massi.from("customers").select().limit(1)
    const id = (data as Customer[])[0].id

    const { data: updated, error } = await massi
      .from("customers")
      .update({ name: "Updated Name" })
      .eq("id", id)

    expect(error).toBeNull()
    expect((updated as Customer[])[0].name).toBe("Updated Name")
  })

  it("deletes the row", async () => {
    const { data } = await massi.from("customers").select().limit(1)
    const id = (data as Customer[])[0].id

    const { error: deleteError } = await massi.from("customers").delete().eq("id", id)
    expect(deleteError).toBeNull()

    const { data: after } = await massi.from("customers").select().eq("id", id)
    expect(after as Customer[]).toHaveLength(0)
  })
})

describe("Error handling", () => {
  afterEach(() => resetAudit())

  it("errors on a table that doesn't exist", async () => {
    const { data, error } = await massi.from("does_not_exist").select()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it("errors on a column that doesn't exist", async () => {
    const { data, error } = await massi.from("customers").select("not_a_real_column")
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it("blocks an anon insert on a table with no RLS policy for anon", async () => {
    const { data, error } = await massi.from("internal_audit").insert({ event: "should not land" })
    expect(data).toBeNull()
    expect(error).not.toBeNull()

    // service_role bypasses RLS, so it can confirm nothing landed.
    const { data: rows } = await admin.from("internal_audit").select()
    expect(rows).toHaveLength(0)
  })
})
