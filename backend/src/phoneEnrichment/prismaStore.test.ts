import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../test/testDb'
import { PrismaPhoneEnrichmentStore } from './prismaStore'
import type { ProviderAttempt } from './types'

const db = createTestDb()
const store = new PrismaPhoneEnrichmentStore(db.prisma)
beforeEach(() => db.reset())
afterAll(() => db.close())

const createLead = (data: Record<string, unknown> = {}) =>
  db.prisma.lead.create({
    data: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.com',
      jobTitle: 'Engineer',
      countryCode: 'GB',
      emailVerificationStatus: 'PENDING',
      phoneEnrichmentStatus: 'PENDING',
      ...data,
    },
  })
const reload = (id: number) => db.prisma.lead.findUniqueOrThrow({ where: { id } })

const skippedOrion: ProviderAttempt = { provider: 'ORION', result: 'SKIPPED', reason: 'no business domain' }

describe('PrismaPhoneEnrichmentStore', () => {
  it('loads the lookup inputs of a lead', async () => {
    const lead = await createLead()

    expect(await store.loadLead(lead.id)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.com',
      jobTitle: 'Engineer',
      countryCode: 'GB',
    })
  })

  it('returns null for a lead that no longer exists', async () => {
    expect(await store.loadLead(999_999)).toBeNull()
  })

  it('records progress without touching other fields', async () => {
    const lead = await createLead()

    await store.recordProgress(lead.id, {
      provider: 'NIMBUS',
      position: 2,
      total: 3,
      attempts: [skippedOrion],
    })

    const stored = await reload(lead.id)
    expect(stored.phoneEnrichmentProgress).toEqual({ provider: 'NIMBUS', position: 2, total: 3 })
    expect(stored.phoneEnrichmentAttempts).toEqual([skippedOrion])
    expect(stored.phoneEnrichmentStatus).toBe('PENDING')
    expect(stored.emailVerificationStatus).toBe('PENDING')
  })

  it('saves a found phone with its source, replacing an existing one, and clears progress', async () => {
    const lead = await createLead({ phone: '555-0100-123', phoneSource: 'IMPORT' })
    await store.recordProgress(lead.id, { provider: 'ASTRA', position: 1, total: 3, attempts: [] })
    const attempts: ProviderAttempt[] = [
      { provider: 'ASTRA', result: 'FOUND', phone: '+15550199000', rawPhone: '5550199000' },
    ]

    await store.savePhone(lead.id, { phone: '+15550199000', source: 'ASTRA', attempts })

    const stored = await reload(lead.id)
    expect(stored).toMatchObject({
      phone: '+15550199000',
      phoneSource: 'ASTRA',
      phoneEnrichmentStatus: 'FOUND',
      phoneEnrichmentProgress: null,
      phoneEnrichmentAttempts: attempts,
      emailVerificationStatus: 'PENDING',
    })
    expect(stored.phoneEnrichedAt).toBeInstanceOf(Date)
  })

  it.each(['NOT_FOUND', 'FAILED'] as const)(
    'saves a %s outcome and keeps the existing phone',
    async (status) => {
      const lead = await createLead({ phone: '555-0100-123', phoneSource: 'IMPORT' })

      await store.saveOutcome(lead.id, { status, attempts: [skippedOrion] })

      const stored = await reload(lead.id)
      expect(stored).toMatchObject({
        phone: '555-0100-123',
        phoneSource: 'IMPORT',
        phoneEnrichmentStatus: status,
        phoneEnrichmentProgress: null,
        phoneEnrichmentAttempts: [skippedOrion],
      })
      expect(stored.phoneEnrichedAt).toBeInstanceOf(Date)
    }
  )

  it('ignores writes for a lead that no longer exists, so activities do not retry forever', async () => {
    await expect(
      store.recordProgress(999_999, { provider: 'ASTRA', position: 1, total: 3, attempts: [] })
    ).resolves.toBeUndefined()
    await expect(
      store.savePhone(999_999, { phone: '+15550199000', source: 'ASTRA', attempts: [] })
    ).resolves.toBeUndefined()
    await expect(store.saveOutcome(999_999, { status: 'FAILED', attempts: [] })).resolves.toBeUndefined()
  })

  it('is safe to repeat', async () => {
    const lead = await createLead()
    const found = { phone: '+15550199000', source: 'ASTRA' as const, attempts: [] }

    await store.savePhone(lead.id, found)
    await store.savePhone(lead.id, found)

    expect((await reload(lead.id)).phone).toBe('+15550199000')
  })
})
