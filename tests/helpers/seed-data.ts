// Mirrors fixtures/seed.sql. Kept as plain data (rather than parsing the
// .sql file) so helpers/admin.ts can insert it over REST — see the note at
// the top of fixtures/seed.sql for why the suite can't just run that file
// directly.

export interface CustomerSeed {
  name: string
  email: string
  country: string
}

export interface ProductSeed {
  name: string
  price_dzd: number
  stock: number
}

// Orders reference customers/products by their position in the arrays
// above (0-indexed) rather than by a fixed id, since SERIAL ids keep
// climbing across resets and we have no way to RESTART IDENTITY over REST.
export interface OrderSeed {
  customerIndex: number
  productIndex: number
  quantity: number
  total_dzd: number
  status: string
}

export const customers: CustomerSeed[] = [
  { name: "Amine Kessar", email: "amine@example.dz", country: "DZ" },
  { name: "Sarah Belkacem", email: "sarah@example.dz", country: "DZ" },
  { name: "John Doe", email: "john@example.com", country: "US" },
]

export const products: ProductSeed[] = [
  { name: "Widget", price_dzd: 1500.0, stock: 100 },
  { name: "Gadget", price_dzd: 4200.5, stock: 40 },
  { name: "Gizmo", price_dzd: 999.99, stock: 0 },
]

export const orders: OrderSeed[] = [
  { customerIndex: 0, productIndex: 0, quantity: 2, total_dzd: 3000.0, status: "pending" },
  { customerIndex: 0, productIndex: 1, quantity: 1, total_dzd: 4200.5, status: "shipped" },
  { customerIndex: 1, productIndex: 2, quantity: 3, total_dzd: 2999.97, status: "cancelled" },
]
