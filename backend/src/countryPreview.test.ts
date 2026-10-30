import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

// The lead-country-code spec's preview requirement, now served by the whole-file import preview.
const db = createTestDb()
const app = createApp(db.prisma, { startEmailVerification: async () => {} })
afterAll(() => db.close())

const previewCountry = async (countryCode: string) => {
  const res = await request(app)
    .post('/leads/import/preview')
    .send({ rows: [{ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@acme.com', countryCode }] })
  return res.body.leads[0]
}

describe('country conversion in the import preview', () => {
  it('shows a converted value and notes the original', async () => {
    const lead = await previewCountry('ESP')

    expect(lead.countryCode).toBe('ES')
    expect(lead.notes).toContainEqual(
      expect.objectContaining({ field: 'countryCode', message: 'Converted from ESP' })
    )
  })

  it('shows a cleared value as blank, notes it, and keeps the lead importable', async () => {
    const lead = await previewCountry('XXX')

    expect(lead.countryCode).toBeNull()
    expect(lead.status).toBe('new')
    expect(lead.notes).toContainEqual(
      expect.objectContaining({ field: 'countryCode', message: 'XXX is not a recognized country' })
    )
  })

  it('shows a kept code without a note', async () => {
    const lead = await previewCountry('FR')

    expect(lead.countryCode).toBe('FR')
    expect(lead.notes).toEqual([])
  })
})
