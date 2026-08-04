import type { SessionStorage } from '../types'

export class MemoryStorage implements SessionStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
}

export class LocalStorageAdapter implements SessionStorage {
  getItem(key: string): string | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  }
  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  }
  removeItem(key: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  }
}

export function defaultStorage(): SessionStorage {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return new LocalStorageAdapter()
  }
  return new MemoryStorage()
}
