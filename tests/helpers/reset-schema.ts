// `npm run reset` — restores the fixture tables to their seed baseline
// without running the test suite. Handy after poking around manually
// (portal table editor, curl) against the test project.
//
// Despite the filename, this does not touch schema (DDL) — see
// fixtures/schema.sql for why that has to be run manually in the portal's
// SQL Console instead. This only resets data, via REST as service_role.

import { checkSchemaReady, resetSeed } from "./admin"

async function main() {
  await checkSchemaReady()
  await resetSeed()
  console.log("Reset customers, products and orders to the seed baseline.")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
