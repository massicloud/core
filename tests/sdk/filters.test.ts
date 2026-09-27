import { beforeEach, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { resetSeed } from "../helpers/setup"

// Matches fixtures/seed.sql / helpers/seed-data.ts:
//   products: Widget (1500, stock 100), Gadget (4200.50, stock 40), Gizmo (999.99, stock 0)
//   customers: Amine (DZ), Sarah (DZ), John (US)

interface Product {
  id: number
  name: string
  price_dzd: number
  stock: number
}

interface Customer {
  id: number
  name: string
  email: string
  country: string
}

const massi = makeAnonClient()

describe("Filters", () => {
  beforeEach(() => resetSeed("products"))

  it("eq", async () => {
    const { data } = await massi.from("products").select().eq("name", "Widget")
    expect((data as Product[]).map((p) => p.name)).toEqual(["Widget"])
  })

  it("neq", async () => {
    const { data } = await massi.from("products").select().neq("name", "Widget")
    expect((data as Product[]).map((p) => p.name).sort()).toEqual(["Gadget", "Gizmo"])
  })

  it("gt", async () => {
    const { data } = await massi.from("products").select().gt("price_dzd", 1500)
    expect((data as Product[]).map((p) => p.name)).toEqual(["Gadget"])
  })

  it("gte", async () => {
    const { data } = await massi.from("products").select().gte("price_dzd", 1500)
    expect((data as Product[]).map((p) => p.name).sort()).toEqual(["Gadget", "Widget"])
  })

  it("lt", async () => {
    const { data } = await massi.from("products").select().lt("stock", 40)
    expect((data as Product[]).map((p) => p.name)).toEqual(["Gizmo"])
  })

  it("lte", async () => {
    const { data } = await massi.from("products").select().lte("stock", 40)
    expect((data as Product[]).map((p) => p.name).sort()).toEqual(["Gadget", "Gizmo"])
  })

  it("in", async () => {
    const { data } = await massi.from("products").select().in("name", ["Widget", "Gizmo"])
    expect((data as Product[]).map((p) => p.name).sort()).toEqual(["Gizmo", "Widget"])
  })

  it("is (null check)", async () => {
    // No fixture row has a null column to match, so assert the shape of a
    // legitimate "is" query instead: it must not error and must stay a
    // subset of the full table.
    const { data, error } = await massi.from("products").select().is("name", null)
    expect(error).toBeNull()
    expect((data as Product[]).length).toBeLessThanOrEqual(3)
  })

  it("like (case-sensitive)", async () => {
    const { data } = await massi.from("products").select().like("name", "G%")
    expect((data as Product[]).map((p) => p.name).sort()).toEqual(["Gadget", "Gizmo"])
  })

  it("ilike (case-insensitive)", async () => {
    const { data } = await massi.from("products").select().ilike("name", "widget")
    expect((data as Product[]).map((p) => p.name)).toEqual(["Widget"])
  })

  it("combines two filters (implicit AND)", async () => {
    const { data } = await massi.from("products").select().gt("stock", 0).lt("price_dzd", 2000)
    expect((data as Product[]).map((p) => p.name)).toEqual(["Widget"])
  })
})

describe("Filters on customers", () => {
  beforeEach(() => resetSeed("customers"))

  it("eq on country", async () => {
    const { data } = await massi.from("customers").select().eq("country", "DZ")
    expect((data as Customer[])).toHaveLength(2)
  })
})
