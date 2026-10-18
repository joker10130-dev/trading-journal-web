import { describe, expect, it } from 'vitest'
import { parseManualR, rSourceFor } from './trade'

describe('manual R', () => {
  it('keeps entered positive, zero, and negative values unchanged', () => {
    expect(parseManualR('2.5')).toBe(2.5)
    expect(parseManualR('0')).toBe(0)
    expect(parseManualR('-1.25')).toBe(-1.25)
  })

  it('treats empty and invalid input as not entered', () => {
    expect(parseManualR('')).toBeNull()
    expect(parseManualR('   ')).toBeNull()
    expect(parseManualR('invalid')).toBeNull()
  })

  it('uses only MANUAL and NONE sources', () => {
    expect(rSourceFor(0)).toBe('MANUAL')
    expect(rSourceFor(null)).toBe('NONE')
  })
})
