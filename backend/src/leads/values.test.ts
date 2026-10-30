import { describe, expect, it } from 'vitest'
import { isCurrentRoleFlag, normalizeLinkedinUrl, normalizePhone, normalizeYearsInRole } from './values'

describe('normalizePhone', () => {
  it.each([
    '(731)123-9702',
    '+1-280-754-0462x2154',
    '001-464-312-8555',
    '7549075690',
    '414-902-6626x468',
    '063.430.8860x4762',
  ])('keeps %j', (input) => {
    expect(normalizePhone(input)).toEqual({ value: input, outcome: 'kept' })
  })

  it('trims surrounding whitespace and collapses inner spaces', () => {
    expect(normalizePhone('  +34  612 345 678 ')).toEqual({ value: '+34 612 345 678', outcome: 'converted' })
  })

  it.each([
    ['12-34', 'has fewer than 7 digits'],
    ['1234567890123456', 'has more than 15 digits'],
    ['call me maybe', 'is not a phone number'],
    ['555-0100 ext', 'is not a phone number'],
  ])('clears %j because it %s', (input, reason) => {
    expect(normalizePhone(input)).toEqual({ value: null, outcome: 'cleared', note: `${input} ${reason}` })
  })

  it.each([undefined, null, '', '   '])('treats %j as empty', (input) => {
    expect(normalizePhone(input)).toEqual({ value: null, outcome: 'empty' })
  })
})

describe('normalizeLinkedinUrl', () => {
  it.each([
    'linkedin.com/in/ada-lovelace/',
    'http://www.linkedin.com/in/ada-lovelace?utm=x',
    'https://es.linkedin.com/in/ada-lovelace',
    'www.linkedin.com/in/ada-lovelace#about',
  ])('converts %j to the canonical form', (input) => {
    expect(normalizeLinkedinUrl(input)).toEqual({
      value: 'https://www.linkedin.com/in/ada-lovelace',
      outcome: 'converted',
    })
  })

  it('keeps an already canonical URL', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/ada-lovelace')).toEqual({
      value: 'https://www.linkedin.com/in/ada-lovelace',
      outcome: 'kept',
    })
  })

  it.each([
    'https://www.linkedin.com/company/acme',
    'https://example.com/in/ada',
    'https://notlinkedin.com/in/ada',
    'https://www.linkedin.com/in/',
    'https://www.linkedin.com/in/ada/details/experience',
    'not a url at all',
    'javascript:alert(1)',
  ])('clears %j', (input) => {
    expect(normalizeLinkedinUrl(input)).toEqual({
      value: null,
      outcome: 'cleared',
      note: `${input} is not a LinkedIn profile URL`,
    })
  })

  it.each([undefined, null, ''])('treats %j as empty', (input) => {
    expect(normalizeLinkedinUrl(input)).toEqual({ value: null, outcome: 'empty' })
  })
})

describe('normalizeYearsInRole', () => {
  it.each([
    ['5', 5],
    [' 15 ', 15],
    [0, 0],
    ['80', 80],
  ])('accepts %j as %d', (input, expected) => {
    expect(normalizeYearsInRole(input)).toEqual({ value: expected, outcome: 'kept' })
  })

  it.each(['2.5', '-1', '81', 'ten', '5 years'])('clears %j', (input) => {
    expect(normalizeYearsInRole(input)).toEqual({
      value: null,
      outcome: 'cleared',
      note: `${input} is not a whole number of years from 0 to 80`,
    })
  })

  it.each([undefined, null, ''])('treats %j as empty', (input) => {
    expect(normalizeYearsInRole(input)).toEqual({ value: null, outcome: 'empty' })
  })
})

describe('isCurrentRoleFlag', () => {
  it.each(['true', 'TRUE', 'yes', 'Yes', '1', 'x', 'X', ' yes '])('reads %j as current', (input) => {
    expect(isCurrentRoleFlag(input)).toBe(true)
  })

  it.each(['false', 'no', '0', '', undefined, null, 'maybe'])('reads %j as not current', (input) => {
    expect(isCurrentRoleFlag(input)).toBe(false)
  })
})
