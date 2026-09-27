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

describe("Count queries", () => {
  beforeEach(() => resetSeed("products"))

  // @massicloud/client v0.3.0's QueryBuilder never sends `Prefer: count=…`
  // and never reads the `Content-Range` response header PostgREST returns
  // it in, so there's no way to get an exact row count without fetching the
  // rows. These count via the length of the fetched array instead, which is
  // the only thing the client currently exposes.

  it("counts all rows via array length", async () => {
    const { data, error } = await massi.from("products").select()
    expect(error).toBeNull()
    expect((data as Product[]).length).toBe(3)
  })

  it("counts filtered rows via array length", async () => {
    const { data, error } = await massi.from("products").select().gt("stock", 0)
    expect(error).toBeNull()
    expect((data as Product[]).length).toBe(2)
  })

  it("gets an exact count without fetching every row", async () => {
    const { data, error, count } = await massi
      .from("products")
      .select("*", { count: "exact", head: true })

    expect(error).toBeNull()
    expect(data).toBeNull() // head: true — no rows come back, just the count
    expect(count).toBe(3)
  })

  it("returns both the page and the total count together", async () => {
    const { data, error, count } = await massi
      .from("products")
      .select("*", { count: "exact" })
      .order("price_dzd")
      .range(0, 1)

    expect(error).toBeNull()
    expect((data as Product[]).length).toBe(2) // this page
    expect(count).toBe(3) // total across all pages
  })
})
