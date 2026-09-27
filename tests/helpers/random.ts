// Unique values for rows tests insert on top of the seed baseline, so
// concurrent/rapid test runs never collide on the customers.email UNIQUE
// constraint.

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function uniqueEmail(local = "test"): string {
  return `${local}-${uniqueSuffix()}@example.dz`
}
