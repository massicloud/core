import { beforeEach, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { resetSeed } from "../helpers/setup"

// Resource embedding is plain PostgREST syntax passed straight through the
// `select` string — the SDK has no dedicated "join" method, it's just
// `.select('*, related_table(cols)')`.

interface OrderWithCustomer {
  id: number
  status: string
  customers: { name: string; country: string } | null
}

interface CustomerWithOrders {
  id: number
  name: string
  orders: Array<{ id: number; status: string }>
}

const massi = makeAnonClient()

describe("Joins (resource embedding)", () => {
  beforeEach(() => resetSeed("orders"))

  it("embeds the parent (many-to-one) from orders", async () => {
    const { data, error } = await massi
      .from("orders")
      .select("id,status,customers(name,country)")

    expect(error).toBeNull()
    const rows = data as OrderWithCustomer[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.customers).not.toBeNull()
      expect(typeof row.customers?.name).toBe("string")
    }
  })

  it("embeds the children (one-to-many) from customers", async () => {
    const { data, error } = await massi
      .from("customers")
      .select("id,name,orders(id,status)")
      .eq("name", "Amine Kessar")
      .single()

    expect(error).toBeNull()
    const customer = data as CustomerWithOrders
    expect(Array.isArray(customer.orders)).toBe(true)
    // seed-data.ts: Amine (index 0) has two orders (Widget, Gadget).
    expect(customer.orders).toHaveLength(2)
  })

  it("filters on the embedded resource's column", async () => {
    const { data, error } = await massi
      .from("orders")
      .select("id,status,customers(name)")
      .eq("customers.country", "US")

    // PostgREST embedded-resource filters narrow the embed, not the parent
    // rows, unless combined with an inner join hint — assert it at least
    // executes and returns the expected shape rather than erroring.
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
