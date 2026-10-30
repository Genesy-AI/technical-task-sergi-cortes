import { describe, expect, it } from 'vitest'
import { readCsvRows } from './csvParser'

// Validation, header mapping, and grouping live in the backend import (backend/src/leads/importLeads.ts).
// The browser only turns file text into rows, keeping headers as written.
describe('readCsvRows', () => {
  it('rejects empty content', () => {
    expect(() => readCsvRows('')).toThrow('CSV content cannot be empty')
    expect(() => readCsvRows('   \n  ')).toThrow('CSV content cannot be empty')
  })

  it('rejects a file with only headers', () => {
    expect(() => readCsvRows('firstName,lastName,email')).toThrow(
      'CSV file appears to be empty or contains no valid data'
    )
  })

  it('rejects rows whose field count does not match the header', () => {
    expect(() => readCsvRows('firstName,lastName,email\nAda,Lovelace,ada@acme.com,extra,more')).toThrow(
      /CSV parsing failed/
    )
  })

  it('rejects unterminated quotes', () => {
    expect(() => readCsvRows('firstName,lastName\n"Ada,Lovelace')).toThrow(/CSV parsing failed/)
  })

  it('returns one object per row with headers exactly as written', () => {
    const rows = readCsvRows('First Name,LinkedIn Profile,yearsInRole\nAda,linkedin.com/in/ada,3')

    expect(rows).toEqual([
      { 'First Name': 'Ada', 'LinkedIn Profile': 'linkedin.com/in/ada', yearsInRole: '3' },
    ])
  })

  it('keeps quoted values with commas', () => {
    const rows = readCsvRows('firstName,companyName\nAda,"Wang, Young and Rowland"')

    expect(rows[0].companyName).toBe('Wang, Young and Rowland')
  })

  it('trims headers and values', () => {
    const rows = readCsvRows(' firstName , email \n  Ada  ,  ada@acme.com  ')

    expect(rows).toEqual([{ firstName: 'Ada', email: 'ada@acme.com' }])
  })

  it('skips empty lines', () => {
    const rows = readCsvRows('firstName,email\nAda,ada@acme.com\n\nAlan,alan@example.com\n')

    expect(rows.map((row) => row.firstName)).toEqual(['Ada', 'Alan'])
  })

  it('keeps unrecognized columns for the backend to ignore', () => {
    const rows = readCsvRows('firstName,favouriteColour\nAda,green')

    expect(rows[0]).toEqual({ firstName: 'Ada', favouriteColour: 'green' })
  })

  it('reads the sample file header', () => {
    const rows = readCsvRows(
      'firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber\n' +
        'Chad,Smith,hancockjames@gmail.com,Child psychotherapist,TV,Global Tech Solutions,2,+1-280-754-0462x2154'
    )

    expect(rows[0]).toMatchObject({ yearsInRole: '2', phoneNumber: '+1-280-754-0462x2154' })
  })
})
