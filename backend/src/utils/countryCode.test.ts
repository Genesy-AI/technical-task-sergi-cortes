import { describe, expect, it } from 'vitest'
import { normalizeCountryCode } from './countryCode'

const codeOf = (input: string | null | undefined) => normalizeCountryCode(input).code

describe('normalizeCountryCode', () => {
  describe('alpha-2 codes', () => {
    it.each(['ES', 'es', 'Es', ' ES '])('converts %j to ES', (input) => {
      expect(codeOf(input)).toBe('ES')
    })

    it('keeps an already valid code', () => {
      expect(normalizeCountryCode('ES')).toEqual({ code: 'ES', outcome: 'kept' })
    })

    it('treats surrounding whitespace as kept', () => {
      expect(normalizeCountryCode(' ES ')).toEqual({ code: 'ES', outcome: 'kept' })
    })

    it('reports a case change as converted', () => {
      expect(normalizeCountryCode('es')).toEqual({ code: 'ES', outcome: 'converted' })
    })

    it.each(['KP', 'TV', 'PW', 'SM'])('keeps the real but unusual code %s', (input) => {
      expect(codeOf(input)).toBe(input)
    })
  })

  describe('alpha-3 codes', () => {
    it.each(['ESP', 'esp', 'Esp'])('converts %j to ES', (input) => {
      expect(normalizeCountryCode(input)).toEqual({ code: 'ES', outcome: 'converted' })
    })

    it('converts USA to US', () => {
      expect(codeOf('USA')).toBe('US')
    })
  })

  describe('numeric codes', () => {
    it.each(['12', '012'])('converts %j to DZ', (input) => {
      expect(normalizeCountryCode(input)).toEqual({ code: 'DZ', outcome: 'converted' })
    })

    it('converts 724 to ES', () => {
      expect(codeOf('724')).toBe('ES')
    })
  })

  describe('reserved aliases', () => {
    it.each([
      ['UK', 'GB'],
      ['uk', 'GB'],
      ['EL', 'GR'],
    ])('converts %j to %s', (input, expected) => {
      expect(normalizeCountryCode(input)).toEqual({ code: expected, outcome: 'converted' })
    })
  })

  describe('English names', () => {
    it.each([
      ['Spain', 'ES'],
      ['SPAIN', 'ES'],
      ['  spain  ', 'ES'],
      ['United States', 'US'],
      ['United States of America', 'US'],
      ['The Netherlands', 'NL'],
      ['Netherlands', 'NL'],
      ["Côte d'Ivoire", 'CI'],
      ["Cote d'Ivoire", 'CI'],
      ['South Korea', 'KR'],
      ['Russia', 'RU'],
      ['UAE', 'AE'],
    ])('converts %j to %s', (input, expected) => {
      expect(normalizeCountryCode(input)).toEqual({ code: expected, outcome: 'converted' })
    })
  })

  describe('unconvertible values become blank', () => {
    it.each(['XXX', 'ZZ', '999', '0', '000', '12.5', '#12', '1000', 'Spian', 'England', '??'])(
      'clears %j',
      (input) => {
        expect(normalizeCountryCode(input)).toEqual({ code: null, outcome: 'cleared' })
      }
    )

    it.each(['Congo', 'Korea'])('clears the ambiguous name %j', (input) => {
      expect(normalizeCountryCode(input)).toEqual({ code: null, outcome: 'cleared' })
    })
  })

  describe('empty input', () => {
    it.each([undefined, null, '', '   '])('returns an empty result for %j', (input) => {
      expect(normalizeCountryCode(input)).toEqual({ code: null, outcome: 'empty' })
    })
  })

  it('is idempotent for every result', () => {
    for (const input of ['es', 'ESP', '12', 'UK', 'Spain', 'XXX']) {
      const first = normalizeCountryCode(input).code
      expect(normalizeCountryCode(first).code).toBe(first)
    }
  })
})
