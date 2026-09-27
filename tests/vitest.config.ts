import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./helpers/setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Network calls hit one real Postgres/PostgREST instance — running
    // suites in parallel workers just races them over the same rows.
    fileParallelism: false,
  },
})
