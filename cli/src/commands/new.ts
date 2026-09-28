import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, resolveSingleDb } from '../lib/config'
import * as logger from '../lib/logger'
import { createMigrationFile } from '../lib/migrations'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadTemplate(): string {
  // Built layout: dist/index.js (bundled) + dist/templates/new-migration.sql
  // Source layout: src/commands/new.ts + src/templates/new-migration.sql
  const candidates = [
    join(__dirname, 'templates', 'new-migration.sql'),
    join(__dirname, '..', 'templates', 'new-migration.sql'),
  ]
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8')
    } catch {
      continue
    }
  }
  throw new Error(`Could not locate migration template near ${__dirname}`)
}

export interface NewOptions {
  configPath: string
  db?: string
  name: string
}

export function runNew(options: NewOptions): void {
  const config = loadConfig({ configPath: options.configPath })
  const db = resolveSingleDb(config, options.db)
  const migrationsDir = resolve(config.databases[db].migrations_dir)
  const template = loadTemplate()

  const file = createMigrationFile(migrationsDir, options.name, template)

  logger.success(`Created ${file.path}`)
}
