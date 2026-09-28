import { describe, expect, it } from 'vitest'
import { validateUrl } from '../src/commands/init'

describe('validateUrl', () => {
  it('rejects an empty string', () => {
    expect(validateUrl('')).not.toBe(true)
  })

  it('rejects a string with no scheme', () => {
    expect(validateUrl('not-a-url')).not.toBe(true)
  })

  it('accepts a plain http:// URL', () => {
    expect(validateUrl('http://valid.com')).toBe(true)
  })

  it('rejects an unreplaced {slug} template placeholder', () => {
    expect(validateUrl('https://api.massicloud.work/v1/{slug}')).not.toBe(true)
  })

  it('accepts a real slug in place of the placeholder', () => {
    expect(validateUrl('https://api.massicloud.work/v1/real-slug-123')).toBe(true)
  })
})
