import { beforeEach, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { resetSeed } from "../helpers/setup"

interface Product {
  id: number
  name: string
  price_dzd: number
  stock: number
}

const massi = makeAnonClient()

describe("Ordering, limit, offset, range", () => {
  beforeEach(() => resetSeed("products"))

  it("orders ascending by default", async () => {
    const { data } = await massi.from("products").select().order("price_dzd")
    expect((data as Product[]).map((p) => p.name)).toEqual(["Gizmo", "Widget", "Gadget"])
  })

  it("orders descending", async () => {
    const { data } = await massi
      .from("products")
      .select()
      .order("price_dzd", { ascending: false })
    expect((data as Product[]).map((p) => p.name)).toEqual(["Gadget", "Widget", "Gizmo"])
  })

  it("limits the number of rows", async () => {
    const { data } = await massi.from("products").select().order("price_dzd").limit(2)
    expect(data as Product[]).toHaveLength(2)
  })

  it("offsets past the first rows", async () => {
    const { data } = await massi.from("products").select().order("price_dzd").offset(1).limit(2)
    expect((data as Product[]).map((p) => p.name)).toEqual(["Widget", "Gadget"])
  })

  it("range selects an inclusive slice", async () => {
    const { data, error } = await massi.from("products").select().order("price_dzd").range(0, 1)
    expect(error).toBeNull()
    expect((data as Product[]).map((p) => p.name)).toEqual(["Gizmo", "Widget"])
  })
})

describe("Column selection", () => {
  beforeEach(() => resetSeed("products"))

  it("returns only the requested columns", async () => {
    const { data, error } = await massi.from("products").select("name,stock").order("name")
    expect(error).toBeNull()
    const rows = data as Array<Record<string, unknown>>
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["name", "stock"])
    }
  })
})
