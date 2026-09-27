import { beforeEach, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { resetSeed } from "../helpers/setup"
import { uniqueEmail } from "../helpers/random"

interface Customer {
  id: number
  name: string
  email: string
  country: string
}

const massi = makeAnonClient()

describe("Bulk insert", () => {
  beforeEach(() => resetSeed("customers"))

  it("inserts an array of rows in one call", async () => {
    const { data, error } = await massi.from("customers").insert([
      { name: "Bulk One", email: uniqueEmail("bulk1"), country: "DZ" },
      { name: "Bulk Two", email: uniqueEmail("bulk2"), country: "DZ" },
    ])

    expect(error).toBeNull()
    const rows = data as Customer[]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.name).sort()).toEqual(["Bulk One", "Bulk Two"])

    const { data: all } = await massi.from("customers").select()
    expect(all as Customer[]).toHaveLength(5) // 3 seeded + 2 bulk
  })
})

describe("Delete with filter", () => {
  beforeEach(() => resetSeed("customers"))

  it("deletes only rows matching the filter", async () => {
    const { error } = await massi.from("customers").delete().eq("country", "US")
    expect(error).toBeNull()

    const { data } = await massi.from("customers").select()
    const remaining = data as Customer[]
    expect(remaining.every((c) => c.country !== "US")).toBe(true)
    expect(remaining).toHaveLength(2) // Amine + Sarah, both DZ
  })
})

describe("Upsert", () => {
  beforeEach(() => resetSeed("customers"))

  // Requires a unique/exclusion constraint on the onConflict column —
  // customers.email is UNIQUE NOT NULL in fixtures/schema.sql, which is
  // what makes onConflict: 'email' valid here. Upserting on a column with
  // no such constraint fails with PostgREST error 42P10
  // ("no unique or exclusion constraint matching the ON CONFLICT
  // specification"), surfaced as `error`, not a thrown exception.

  it("updates the existing row instead of creating a duplicate", async () => {
    const { data: existing } = await massi.from("customers").select().limit(1)
    const target = (existing as Customer[])[0]

    const { data, error } = await massi.from("customers").upsert(
      { email: target.email, name: "Upserted Name", country: target.country },
      { onConflict: "email" },
    )

    expect(error).toBeNull()
    const rows = data as Customer[]
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(target.id) // same row, not a new one
    expect(rows[0].name).toBe("Upserted Name")

    const { data: all } = await massi.from("customers").select()
    expect(all as Customer[]).toHaveLength(3) // still 3 — no duplicate inserted
  })

  it("inserts a new row when the conflict column matches nothing existing", async () => {
    const email = uniqueEmail("upsert-new")
    const { data, error } = await massi
      .from("customers")
      .upsert({ email, name: "Brand New", country: "DZ" }, { onConflict: "email" })

    expect(error).toBeNull()
    expect((data as Customer[])[0].email).toBe(email)

    const { data: all } = await massi.from("customers").select()
    expect(all as Customer[]).toHaveLength(4)
  })

  it("ignoreDuplicates leaves the existing row untouched", async () => {
    const { data: existing } = await massi.from("customers").select().limit(1)
    const target = (existing as Customer[])[0]

    const { error } = await massi.from("customers").upsert(
      { email: target.email, name: "Should Not Apply", country: target.country },
      { onConflict: "email", ignoreDuplicates: true },
    )
    expect(error).toBeNull()

    const { data: after } = await massi
      .from("customers")
      .select()
      .eq("id", target.id)
      .single()
    expect((after as Customer).name).toBe(target.name) // unchanged
  })
})
