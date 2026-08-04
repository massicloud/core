export interface MassiCloudConfig {
  /**
   * The base URL of the MassiCloud API, including project slug.
   * Example: https://api.massicloud.dz/v1/my-project
   */
  url: string

  /**
   * The anonymous (or service) key for this project.
   * Anonymous keys are safe to ship in browsers; service keys are NOT.
   */
  key: string

  /**
   * Which stage (environment) to talk to. Required.
   * Examples: 'production', 'staging', 'development'.
   */
  stage: string

  /**
   * Which database within the stage. Defaults to 'main'.
   * Use the .db() method to switch databases ad-hoc.
   */
  db?: string

  /** Auth-related configuration. */
  auth?: AuthConfig

  /**
   * Override the default fetch implementation (useful for testing
   * or Node environments before native fetch).
   */
  fetch?: typeof fetch

  /** Default headers attached to every request. */
  headers?: Record<string, string>
}

export interface AuthConfig {
  /**
   * Persist the session across browser reloads.
   * Default: true in browser, false in Node.
   */
  persistSession?: boolean

  /** Automatically refresh expired tokens before they fail. Default: true. */
  autoRefreshToken?: boolean

  /**
   * Storage adapter for persisting session. Default: localStorage in browser.
   * Provide a custom adapter for React Native (AsyncStorage) or other envs.
   */
  storage?: SessionStorage

  /** Key used in storage. Default: 'massicloud.{stage}.auth.token'. */
  storageKey?: string
}

export interface SessionStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number // unix seconds
  token_type: string
  user: User
}

export interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at?: string | null
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'

export type AuthChangeCallback = (event: AuthEvent, session: Session | null) => void

export interface MassiResponse<T> {
  data: T | null
  error: MassiError | null
}

export interface MassiError {
  message: string
  code?: string
  status?: number
  details?: unknown
}
