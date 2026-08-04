"use client";

const TOKEN_KEY    = "massicloud_token";
const REMEMBER_KEY = "massicloud_remember_email";

// 7 days — matches the server-side JWT expiry default
const SESSION_MAX_AGE  = 60 * 60 * 24 * 7;
// 30 days — when "remember me" is checked
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember = false): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  const maxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getSavedEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REMEMBER_KEY) ?? "";
}

export function saveRememberEmail(email: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, email);
}

export function clearRememberEmail(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REMEMBER_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function getAuthHeader(): { Authorization: string } | Record<string, never> {
  const token = getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
