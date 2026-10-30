import { describe, expect, it } from 'vitest'
import { TEMPLATE_FIELD_KEYS } from '../leads/leadFields'
import { generateMessageFromTemplate } from './messageGenerator'

const lead = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'Eng. Manager',
  companyName: 'Acme',
  countryCode: 'GB',
  phone: '555-0100-123',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  yearsInRole: 0,
  yearsAtCompany: 5,
}

describe('generateMessageFromTemplate with registry fields', () => {
  it('renders the new profile fields', () => {
    expect(generateMessageFromTemplate('Call me at {phone} or see {linkedinUrl}', lead)).toBe(
      'Call me at 555-0100-123 or see https://www.linkedin.com/in/ada'
    )
  })

  it('renders numeric years, including zero', () => {
    expect(
      generateMessageFromTemplate('{yearsAtCompany} years at {companyName}, {yearsInRole} in role', lead)
    ).toBe('5 years at Acme, 0 in role')
  })

  it('reports a missing new field like any other', () => {
    expect(() => generateMessageFromTemplate('Call {phone}', { ...lead, phone: null })).toThrow(
      'Missing required field: phone'
    )
  })

  it('accepts exactly the templatable registry fields', () => {
    for (const key of TEMPLATE_FIELD_KEYS) {
      expect(() => generateMessageFromTemplate(`{${key}}`, lead)).not.toThrow(/Unknown field/)
    }
    expect(() => generateMessageFromTemplate('{message}', lead)).toThrow('Unknown field in template: message')
    expect(() => generateMessageFromTemplate('{createdAt}', lead)).toThrow(
      'Unknown field in template: createdAt'
    )
  })

  it('treats a value containing replacement patterns literally', () => {
    expect(generateMessageFromTemplate('Hi {companyName}', { ...lead, companyName: 'A$&B $1' })).toBe(
      'Hi A$&B $1'
    )
  })
})
