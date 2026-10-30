import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma)

beforeEach(() => db.reset())
afterAll(() => db.close())

/**
 * The rows the import modal sends for docs/leads-with-errors.csv: only the rows it marks valid,
 * with countries exactly as they appear in the file (an empty country is omitted).
 * Captured from the end-to-end reproduction in design/fixes/FIX-001-csv-country-codes.md.
 */
const sampleFileValidRows = [
  { firstName: 'Iñaki', lastName: 'Álvarez', email: 'rodriguezbrian@smith.net', countryCode: 'ES' },
  { firstName: 'Curtis', lastName: 'Monson', email: 'curtismonson80@gmail.com', countryCode: 'US' },
  { firstName: 'Meghan', lastName: 'Williams', email: 'michael04@jones-marshall.com', countryCode: 'TH' },
  { firstName: 'Amanda', lastName: 'James', email: 'kevin03@beard.net', countryCode: '12' },
  { firstName: 'Latasha', lastName: 'Martin', email: 'aprilmcconnell@gmail.com', countryCode: 'XXX' },
  { firstName: 'Linda', lastName: 'Choi', email: 'ramireztracy@norton-jackson.biz', countryCode: 'XXX' },
  { firstName: 'Stephen', lastName: 'Brown', email: 'lconrad@bennett.org', countryCode: 'FR' },
  { firstName: 'Steven', lastName: 'Hernandez', email: 'rodriguezbrian@smith.net' },
]

const storedCountries = async () => {
  const leads = await db.prisma.lead.findMany({ orderBy: { id: 'asc' } })
  return Object.fromEntries(leads.map((l) => [`${l.firstName} ${l.lastName}`, l.countryCode]))
}

describe('POST /leads/bulk country codes', () => {
  it('never stores the invalid countries from the sample file', async () => {
    const res = await request(app).post('/leads/bulk').send({ rows: sampleFileValidRows })

    expect(res.status).toBe(200)
    const countries = Object.values(await storedCountries())
    expect(countries).not.toContain('XXX')
    expect(countries).not.toContain('12')
  })

  it('converts or clears each sample country as the spec requires', async () => {
    await request(app).post('/leads/bulk').send({ rows: sampleFileValidRows })

    // Steven Hernandez shares rodriguezbrian@smith.net with Iñaki Álvarez, so since add-lead-fields
    // both rows are one person (lead-import spec), keeping the first name and Iñaki's country.
    expect(await storedCountries()).toEqual({
      'Iñaki Álvarez': 'ES',
      'Curtis Monson': 'US',
      'Meghan Williams': 'TH',
      'Amanda James': 'DZ',
      'Latasha Martin': null,
      'Linda Choi': null,
      'Stephen Brown': 'FR',
    })
  })

  it('accepts a numeric country sent as a JSON number', async () => {
    const res = await request(app)
      .post('/leads/bulk')
      .send({
        rows: [{ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', countryCode: 724 }],
      })

    expect(res.status).toBe(200)
    expect(await storedCountries()).toEqual({ 'Ada Lovelace': 'ES' })
  })
})
