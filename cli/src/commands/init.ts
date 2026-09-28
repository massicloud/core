import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import prompts from 'prompts'
import * as logger from '../lib/logger'

export interface InitOptions {
  configPath: string
  force?: boolean
}

/** Exported for testing. Used as the `validate` fn on the URL prompt. */
export function validateUrl(value: string): true | string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return 'URL is required'
  if (!/^https?:\/\//i.test(trimmed)) return 'URL must start with http:// or https://'
  if (/\{.*\}/.test(trimmed)) return 'URL contains template placeholder — replace with real slug'
  return true
}

export async function runInit(options: InitOptions): Promise<void> {
  const configPath = resolve(options.configPath)

  if (existsSync(configPath) && !options.force) {
    logger.fail(`Error: massicloud.config.json already exists at ${configPath}.`)
    logger.fail('Use --force to overwrite.')
    process.exitCode = 1
    return
  }

  const answers = await prompts([
    {
      type: 'text',
      name: 'url',
      message: 'API base URL',
      hint: 'e.g. https://api.massicloud.work/v1/myproject-abc123',
      validate: validateUrl,
    },
    {
      type: 'text',
      name: 'service_key',
      message: 'Service key (or ${ENV_VAR} to read from env)',
      initial: '${MASSICLOUD_SERVICE_KEY}',
    },
    {
      type: 'text',
      name: 'stages',
      message: 'Stages (comma-separated, in promotion order)',
      initial: 'development,staging,production',
    },
    {
      type: 'text',
      name: 'db',
      message: 'Initial database name',
      initial: 'main',
    },
    {
      type: 'text',
      name: 'migrations_dir',
      message: (prev: string) => `Migrations directory for "${prev}"`,
      initial: './migrations',
    },
  ])

  const stages = String(answers.stages ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (
    !answers.url ||
    !answers.service_key ||
    stages.length === 0 ||
    !answers.db ||
    !answers.migrations_dir
  ) {
    logger.info('Aborted.')
    return
  }

  const config = {
    url: answers.url,
    service_key: answers.service_key,
    stages,
    databases: {
      [answers.db]: {
        migrations_dir: answers.migrations_dir,
      },
    },
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  mkdirSync(resolve(answers.migrations_dir), { recursive: true })

  logger.success(`Created ${configPath}`)
  logger.success(`Created ${resolve(answers.migrations_dir)}`)
  logger.info(
    `Add more databases by editing "databases" in ${configPath}, each with its own migrations_dir.`,
  )
}
