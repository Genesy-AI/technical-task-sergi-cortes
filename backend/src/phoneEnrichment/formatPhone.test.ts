import { describe, expect, it } from 'vitest'
import { formatPhone } from './formatPhone'

describe('formatPhone', () => {
  it('formats with the first country that makes the number valid', () => {
    expect(formatPhone('612345678', ['ES', 'US'])).toBe('+34612345678')
    expect(formatPhone('(405) 630-4797', [undefined, 'US'])).toBe('+14056304797')
  })

  it('keeps an international number in E.164 regardless of the countries', () => {
    expect(formatPhone('+34 612 34 56 78', ['US'])).toBe('+34612345678')
    expect(formatPhone('+34 612 34 56 78', [])).toBe('+34612345678')
  })

  it('falls back to the next country when the first does not fit', () => {
    expect(formatPhone('4056304797', ['ES', 'US'])).toBe('+14056304797')
  })

  it('keeps the number as returned when no country makes it valid', () => {
    expect(formatPhone('4056304797', [])).toBe('4056304797')
    expect(formatPhone('12', ['ES'])).toBe('12')
  })

  it('ignores countries it does not know', () => {
    expect(formatPhone('612345678', ['ZZ', 'not-a-country', null, 'es'])).toBe('+34612345678')
  })
})
