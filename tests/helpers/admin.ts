// Service-role helpers for test setup/teardown.
//
// The original plan for this file was "direct psql via service key," but
// that's not how MassiCloud actually exposes Postgres: the service key only
// ever reaches the project through PostgREST (proxied by the MassiCloud
// API), which has no SQL/DDL endpoint, and the tenant Postgres has no
// network path from outside the cluster (see fixtures/schema.sql). So this
// file resets data over REST instead — service_role bypasses RLS, which is
// enough to freely rewrite the three fixture tables between tests.
//
// Row order matters: orders references customers and products by id, and
// SERIAL ids climb forever (no way to RESTART IDENTITY over REST), so every
// reset deletes and reinserts in dependency order and looks up the fresh
// ids it just got back instead of assuming any fixed value.

import { makeServiceClient } from "./client"
import { customers, orders, products } from "./seed-data"

const admin = makeServiceClient()

interface WithId {
  id: number
}

export type SeedTable = "customers" | "products" | "orders"

/**
 * Wipes and reseeds customers, products and orders back to the baseline in
 * seed-data.ts. The `scope` argument only documents which table a call site
 * cares about — customers/products/orders are FK-linked, so every call
 * resets all three to keep them consistent.
 */
export async function resetSeed(_scope?: SeedTable): Promise<void> {
  // Children before parents, so FK constraints never block a delete.
  const delOrders = await admin.from("orders").delete()
  if (delOrders.error) throw new Error(`delete orders: ${delOrders.error.message}`)

  const delCustomers = await admin.from("customers").delete()
  if (delCustomers.error) throw new Error(`delete customers: ${delCustomers.error.message}`)

  const delProducts = await admin.from("products").delete()
  if (delProducts.error) throw new Error(`delete products: ${delProducts.error.message}`)

  const custRes = await admin.from("customers").insert(customers)
  if (custRes.error) throw new Error(`seed customers: ${custRes.error.message}`)
  const insertedCustomers = custRes.data as WithId[]

  const prodRes = await admin.from("products").insert(products)
  if (prodRes.error) throw new Error(`seed products: ${prodRes.error.message}`)
  const insertedProducts = prodRes.data as WithId[]

  const orderRows = orders.map((o) => ({
    customer_id: insertedCustomers[o.customerIndex].id,
    product_id: insertedProducts[o.productIndex].id,
    quantity: o.quantity,
    total_dzd: o.total_dzd,
    status: o.status,
  }))

  const orderRes = await admin.from("orders").insert(orderRows)
  if (orderRes.error) throw new Error(`seed orders: ${orderRes.error.message}`)
}

/** Empties internal_audit — used only by the RLS-blocked test in crud.test.ts. */
export async function resetAudit(): Promise<void> {
  const res = await admin.from("internal_audit").delete()
  if (res.error) throw new Error(`delete internal_audit: ${res.error.message}`)
}

/**
 * Fails fast with a clear message if the fixture tables don't exist yet,
 * instead of every test in the run failing on an opaque "relation does not
 * exist" error.
 */
export async function checkSchemaReady(): Promise<void> {
  const { error } = await admin.from("customers").select("id").limit(1)
  if (error) {
    throw new Error(
      "Test schema isn't set up on this project yet " +
        `(${error.message}). Run fixtures/schema.sql in the portal's SQL ` +
        "Console for the project in .env.test, then try again.",
    )
  }
}
