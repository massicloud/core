// Vitest global setup: runs once before any test file. Confirms the test
// project is reachable and that fixtures/schema.sql has been applied to it,
// so a missing/misconfigured project fails once with a clear message
// instead of as forty separate "relation does not exist" test failures.
//
// Also re-exports resetSeed so test files can do:
//   import { resetSeed } from '../helpers/setup'
//   beforeEach(() => resetSeed('customers'))

import { checkSchemaReady } from "./admin"

export { resetSeed } from "./admin"

export default async function globalSetup(): Promise<void> {
  await checkSchemaReady()
}
