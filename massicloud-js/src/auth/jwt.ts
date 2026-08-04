/**
 * Decodes a JWT without verifying the signature.
 * Used ONLY to read the expiration claim for proactive token refresh.
 * NEVER use this for security decisions — the backend validates all tokens.
 */
export function decodeJWT(
  token: string,
): { exp?: number; sub?: string; [k: string]: unknown } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    // base64url → base64 → binary string → JSON
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as { exp?: number; sub?: string; [k: string]: unknown }
  } catch {
    return null
  }
}

export function getTokenExpiry(token: string): number | null {
  const decoded = decodeJWT(token)
  return decoded?.exp ?? null
}

export function isTokenExpired(token: string, leewaySeconds = 60): boolean {
  const exp = getTokenExpiry(token)
  if (exp === null) return true
  return Date.now() / 1000 + leewaySeconds >= exp
}
