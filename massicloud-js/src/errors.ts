import type { MassiError } from './types'

export class MassiCloudError extends Error implements MassiError {
  code?: string
  status?: number
  details?: unknown

  constructor(
    message: string,
    opts: { code?: string; status?: number; details?: unknown } = {},
  ) {
    super(message)
    this.name = 'MassiCloudError'
    this.code = opts.code
    this.status = opts.status
    this.details = opts.details
  }
}

export function isMassiCloudError(e: unknown): e is MassiCloudError {
  return e instanceof MassiCloudError
}
