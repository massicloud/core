import { MassiCloudError } from '../errors'
import { isTokenExpired } from './jwt'
import { defaultStorage, MemoryStorage } from './storage'
import type {
  AuthConfig,
  AuthChangeCallback,
  AuthEvent,
  MassiResponse,
  Session,
  SessionStorage,
  User,
} from '../types'

const DEFAULT_STORAGE_KEY = 'massicloud.auth.token'

interface AuthOptions {
  url: string         // base URL including /db/{db}
  key: string         // anon key
  fetch: typeof fetch
  config: AuthConfig
}

export class AuthClient {
  private url: string
  private key: string
  private fetcher: typeof fetch
  private storage: SessionStorage
  private storageKey: string
  private persistSession: boolean
  private autoRefresh: boolean

  private currentSession: Session | null = null
  private listeners = new Set<AuthChangeCallback>()
  private refreshTimer?: ReturnType<typeof setTimeout>
  private initialized = false
  private initPromise: Promise<void>

  constructor(opts: AuthOptions) {
    this.url = opts.url
    this.key = opts.key
    this.fetcher = opts.fetch
    this.persistSession = opts.config.persistSession ?? (typeof window !== 'undefined')
    this.autoRefresh = opts.config.autoRefreshToken ?? true
    this.storage =
      opts.config.storage ??
      (this.persistSession ? defaultStorage() : new MemoryStorage())
    this.storageKey = opts.config.storageKey ?? DEFAULT_STORAGE_KEY

    this.initPromise = this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const stored = await this.storage.getItem(this.storageKey)
      if (stored) {
        const session = JSON.parse(stored) as Session
        if (!isTokenExpired(session.access_token, 60)) {
          this.currentSession = session
          this.scheduleRefresh()
        } else if (session.refresh_token) {
          await this.refreshSession(session.refresh_token)
        } else {
          await this.storage.removeItem(this.storageKey)
        }
      }
    } catch {
      // Bad data in storage — wipe it
      try { await this.storage.removeItem(this.storageKey) } catch { /* noop */ }
    }
    this.initialized = true
  }

  private async ready(): Promise<void> {
    if (!this.initialized) await this.initPromise
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async signUp(credentials: { email: string; password: string }): Promise<MassiResponse<Session>> {
    return this.authRequest('signup', credentials)
  }

  async signIn(credentials: { email: string; password: string }): Promise<MassiResponse<Session>> {
    return this.authRequest('login', credentials)
  }

  async signOut(): Promise<{ error: null | MassiCloudError }> {
    await this.ready()
    this.clearSession()
    this.emit('SIGNED_OUT', null)
    return { error: null }
  }

  async getSession(): Promise<MassiResponse<Session>> {
    await this.ready()
    return { data: this.currentSession, error: null }
  }

  async getUser(): Promise<MassiResponse<User>> {
    await this.ready()
    if (!this.currentSession) {
      return {
        data: null,
        error: new MassiCloudError('not authenticated', { status: 401 }),
      }
    }

    try {
      const res = await this.fetcher(`${this.url}/auth/user`, {
        headers: {
          'X-MassiCloud-Key': this.key,
          Authorization: `Bearer ${this.currentSession.access_token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        return {
          data: null,
          error: new MassiCloudError(
            String(body.error ?? 'failed to fetch user'),
            { status: res.status },
          ),
        }
      }

      const user = (await res.json()) as User
      return { data: user, error: null }
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  onAuthStateChange(callback: AuthChangeCallback): { unsubscribe: () => void } {
    this.listeners.add(callback)
    return { unsubscribe: () => this.listeners.delete(callback) }
  }

  /** Returns the current access token, refreshing proactively if it's near expiry. */
  async getAccessToken(): Promise<string | null> {
    await this.ready()
    if (!this.currentSession) return null

    if (this.autoRefresh && isTokenExpired(this.currentSession.access_token, 60)) {
      const ok = await this.refreshSession(this.currentSession.refresh_token)
      if (!ok) return null
    }
    return this.currentSession?.access_token ?? null
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async authRequest(
    path: 'signup' | 'login',
    body: { email: string; password: string },
  ): Promise<MassiResponse<Session>> {
    try {
      const res = await this.fetcher(`${this.url}/auth/${path}`, {
        method: 'POST',
        headers: {
          'X-MassiCloud-Key': this.key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => ({})) as Record<string, unknown>

      if (!res.ok) {
        return {
          data: null,
          error: new MassiCloudError(
            String(json.error ?? 'auth failed'),
            { status: res.status },
          ),
        }
      }

      const session = this.buildSession(json)
      await this.setSession(session)
      this.emit('SIGNED_IN', session)

      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: new MassiCloudError((e as Error).message) }
    }
  }

  private buildSession(raw: Record<string, unknown>): Session {
    const expiresIn = (raw.expires_in as number | undefined) ?? 3600
    return {
      access_token: raw.access_token as string,
      refresh_token: raw.refresh_token as string,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      token_type: (raw.token_type as string | undefined) ?? 'Bearer',
      user: raw.user as User,
    }
  }

  private async setSession(session: Session): Promise<void> {
    this.currentSession = session
    if (this.persistSession) {
      await this.storage.setItem(this.storageKey, JSON.stringify(session))
    }
    this.scheduleRefresh()
  }

  private clearSession(): void {
    this.currentSession = null
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    if (this.persistSession) {
      void this.storage.removeItem(this.storageKey)
    }
  }

  private scheduleRefresh(): void {
    if (!this.autoRefresh || !this.currentSession) return
    if (this.refreshTimer) clearTimeout(this.refreshTimer)

    const now = Date.now() / 1000
    const refreshAt = this.currentSession.expires_at - 60
    const delayMs = Math.max(0, (refreshAt - now) * 1000)

    this.refreshTimer = setTimeout(() => {
      void this.refreshSession(this.currentSession!.refresh_token)
    }, delayMs)
  }

  private async refreshSession(refreshToken: string): Promise<boolean> {
    try {
      const res = await this.fetcher(`${this.url}/auth/refresh`, {
        method: 'POST',
        headers: {
          'X-MassiCloud-Key': this.key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!res.ok) {
        this.clearSession()
        this.emit('SIGNED_OUT', null)
        return false
      }

      const json = await res.json() as Record<string, unknown>

      // Refresh endpoint returns new access_token; keep existing refresh_token & user
      const newSession: Session = {
        ...this.currentSession!,
        access_token: json.access_token as string,
        expires_at: Math.floor(Date.now() / 1000) + ((json.expires_in as number | undefined) ?? 3600),
      }

      await this.setSession(newSession)
      this.emit('TOKEN_REFRESHED', newSession)
      return true
    } catch {
      this.clearSession()
      this.emit('SIGNED_OUT', null)
      return false
    }
  }

  private emit(event: AuthEvent, session: Session | null): void {
    this.listeners.forEach((cb) => {
      try { cb(event, session) } catch (e) { console.error('[massicloud] listener error', e) }
    })
  }
}
