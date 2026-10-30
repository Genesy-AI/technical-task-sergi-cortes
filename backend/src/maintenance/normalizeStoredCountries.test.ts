import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../test/testDb'
import { normalizeStoredCountries } from './normalizeStoredCountries'

const db = createTestDb()

beforeEach(async () => {
  await db.reset()
  await db.prisma.lead.createMany({
    data: [
      { firstName: 'Emily', lastName: 'Johnson', email: 'emily@example.com', countryCode: 'UK' },
      { firstName: 'Latasha', lastName: 'Martin', email: 'latasha@example.com', countryCode: 'XXX' },
      { firstName: 'Laura', lastName: 'Martinez', email: 'laura@example.com', countryCode: 'ES' },
      { firstName: 'Margaret', lastName: 'Wilson', email: 'margaret@example.com', countryCode: null },
    ],
  })
})
afterAll(() => db.close())

const storedCountries = async () => {
  const leads = await db.prisma.lead.findMany({ orderBy: { id: 'asc' } })
  return leads.map((lead) => lead.countryCode)
}

describe('normalizeStoredCountries', () => {
  it('lists planned changes without writing in dry-run mode', async () => {
    const changes = await normalizeStoredCountries(db.prisma, { apply: false })

    expect(changes).toEqual([
      expect.objectContaining({ name: 'Emily Johnson', from: 'UK', to: 'GB' }),
      expect.objectContaining({ name: 'Latasha Martin', from: 'XXX', to: null }),
    ])
    expect(await storedCountries()).toEqual(['UK', 'XXX', 'ES', null])
  })

  it('writes the converted values in apply mode', async () => {
    await normalizeStoredCountries(db.prisma, { apply: true })

    expect(await storedCountries()).toEqual(['GB', null, 'ES', null])
  })

  it('reports zero changes when run again after applying', async () => {
    await normalizeStoredCountries(db.prisma, { apply: true })

    expect(await normalizeStoredCountries(db.prisma, { apply: true })).toEqual([])
  })
})
