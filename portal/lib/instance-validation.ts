const INSTANCE_NAME_REGEX = /^[a-z][a-z0-9_-]{0,62}$/
const RESERVED_NAMES = new Set([
  'auth', 'rest', 'api', 'admin', 'v1', 'system', 'public',
])

export function validateInstanceName(name: string): string | null {
  if (!name) return 'Required'
  if (!INSTANCE_NAME_REGEX.test(name)) {
    return 'Must be lowercase, start with a letter, and contain only letters, digits, hyphens, or underscores'
  }
  if (RESERVED_NAMES.has(name)) {
    return `"${name}" is a reserved name`
  }
  return null
}
