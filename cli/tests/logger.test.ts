import { describe, expect, it, vi } from 'vitest'
import { table } from '../src/lib/logger'

describe('table', () => {
  it('pads columns to the widest cell', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    table([
      ['Version', 'Name'],
      ['1', 'a-long-name'],
    ])

    // Trailing padding on the last column is trimmed.
    expect(logSpy.mock.calls[0][0]).toBe('Version  Name')
    expect(logSpy.mock.calls[1][0]).toBe('1        a-long-name')

    logSpy.mockRestore()
  })

  it('does not throw on ragged rows (fewer cells than the widest row)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Regression for bug B's literal symptom: "Cannot read properties of
    // undefined (reading 'length')" when a row has fewer cells than the
    // header it's printed alongside.
    expect(() =>
      table([
        ['Version', 'Name', 'production'],
        ['1', 'a'],
      ]),
    ).not.toThrow()

    logSpy.mockRestore()
  })

  it('does nothing for an empty row set', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    table([])
    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
