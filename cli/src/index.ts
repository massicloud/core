import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { runCheckOrphans } from './commands/check-orphans'
import { runDown } from './commands/down'
import { runInit } from './commands/init'
import { runNew } from './commands/new'
import { runStatus } from './commands/status'
import { runUp } from './commands/up'
import { runVerify } from './commands/verify'
import * as logger from './lib/logger'

const program = new Command()

program
  .name('massicloud')
  .description('Migration runner for MassiCloud')
  .version(pkg.version, '-V, --version', 'output the version number')
  .option('--config <path>', 'path to massicloud.config.json', './massicloud.config.json')

program
  .command('init')
  .description('Create massicloud.config.json interactively')
  .option('--force', 'overwrite existing config file')
  .action(async (options: { force?: boolean }, command: Command) => {
    await runInit({ configPath: command.optsWithGlobals().config, force: options.force })
  })

const migrate = program.command('migrate').description('Manage database migrations')

migrate
  .command('new <name>')
  .description('Generate a new migration file')
  .option('--db <name>', 'database to generate the migration for (default: the only configured db)')
  .action((name: string, options: { db?: string }, command: Command) => {
    runNew({ configPath: command.optsWithGlobals().config, db: options.db, name })
  })

migrate
  .command('up')
  .description('Apply all pending migrations for a (stage, db) target')
  .option('--stage <stage>', 'stage to apply migrations to (or MASSICLOUD_STAGE)')
  .option('--db <name>', 'database to target (default: the only configured db)')
  .option('--to <version>', 'apply up to and including this version')
  .action(async (options: { stage?: string; db?: string; to?: string }, command: Command) => {
    await runUp({
      configPath: command.optsWithGlobals().config,
      stage: options.stage,
      db: options.db,
      to: options.to,
    })
  })

migrate
  .command('down')
  .description('Rollback migrations for a (stage, db) target (or back to --to, exclusive)')
  .option('--stage <stage>', 'stage to rollback migrations on (or MASSICLOUD_STAGE)')
  .option('--db <name>', 'database to target (default: the only configured db)')
  .option('--to <version>', 'rollback everything after this version')
  .action(async (options: { stage?: string; db?: string; to?: string }, command: Command) => {
    await runDown({
      configPath: command.optsWithGlobals().config,
      stage: options.stage,
      db: options.db,
      to: options.to,
    })
  })

migrate
  .command('status')
  .description('Show applied/pending migrations, one column per stage')
  .option('--db <name>', 'database to show (default: all configured databases)')
  .action(async (options: { db?: string }, command: Command) => {
    await runStatus({ configPath: command.optsWithGlobals().config, db: options.db })
  })

migrate
  .command('verify')
  .description('Check for divergence between local files and server state (for CI)')
  .option('--stage <stage>', 'stage to check (default: all configured stages)')
  .option('--db <name>', 'database to check (default: all configured databases)')
  .action(async (options: { stage?: string; db?: string }, command: Command) => {
    await runVerify({
      configPath: command.optsWithGlobals().config,
      stage: options.stage,
      db: options.db,
    })
  })

migrate
  .command('check-orphans')
  .description('List local migration files unapplied in every stage (safe to delete)')
  .option('--db <name>', 'database to check (default: all configured databases)')
  .action(async (options: { db?: string }, command: Command) => {
    await runCheckOrphans({ configPath: command.optsWithGlobals().config, db: options.db })
  })

async function main() {
  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    logger.printError(err)
    process.exitCode = 1
  }
}

main()
