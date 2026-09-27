import path from "node:path"
import { config } from "dotenv"
import { createClient, type MassiCloudClient } from "@massicloud/client"

// Loaded explicitly (rather than the `import 'dotenv/config'` side-effect
// form) because our file is `.env.test`, not dotenv's default `.env` — and
// this needs to work both under Vitest and under `tsx helpers/*.ts` run
// directly (the `reset` script), which never touches vitest.config.ts.
config({ path: path.resolve(process.cwd(), ".env.test") })

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.test.example to .env.test and fill it in.`,
    )
  }
  return value
}

export function makeAnonClient(): MassiCloudClient {
  return createClient({
    url: requireEnv("MASSICLOUD_URL"),
    key: requireEnv("MASSICLOUD_ANON_KEY"),
    stage: requireEnv("MASSICLOUD_STAGE"),
    db: requireEnv("MASSICLOUD_DB"),
  })
}

export function makeServiceClient(): MassiCloudClient {
  return createClient({
    url: requireEnv("MASSICLOUD_URL"),
    key: requireEnv("MASSICLOUD_SERVICE_KEY"),
    stage: requireEnv("MASSICLOUD_STAGE"),
    db: requireEnv("MASSICLOUD_DB"),
  })
}
