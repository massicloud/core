export class MassiCloudCliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** massicloud.config.json is missing, unreadable, or fails validation. */
export class ConfigError extends MassiCloudCliError {}

/** A migration file is malformed (missing an Up/Down marker, bad filename). */
export class MigrationFileError extends MassiCloudCliError {}

/**
 * The server has applied a migration whose file no longer exists locally.
 * Corresponds to spec case D9.
 */
export class MissingLocalMigrationError extends MassiCloudCliError {}

/**
 * A local migration file's contents no longer match the checksum recorded
 * when it was applied. Corresponds to spec case D6.
 */
export class ChecksumMismatchError extends MassiCloudCliError {}

/** The server rejected the request outright (network, 5xx, malformed body). */
export class ApiError extends MassiCloudCliError {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

/** 403 from the /query endpoint. */
export class AuthError extends ApiError {}

/** 404 from the /query endpoint. */
export class NotFoundError extends ApiError {}

/** 400 from the /query endpoint — a SQL statement failed to execute. */
export class SqlError extends ApiError {
  constructor(
    message: string,
    readonly code?: string,
    readonly detail?: string,
    readonly hint?: string,
    readonly position?: string | number,
  ) {
    super(message, 400)
  }
}
