import { afterAll, describe, expect, it } from 'vitest'
import { migratedUpTo } from './migrations'

/** The last migration before phone enrichment fields existed. */
const harness = migratedUpTo('20261030100000_add_lead_profile_and_roles')
afterAll(() => harness.cleanup())

describe('phone enrichment migration', () => {
  it('starts every lead as not enriched and marks existing phones as imported', async () => {
    const seeder = harness.connect()
    await seeder.$executeRawUnsafe(`
      INSERT INTO "lead" ("firstName", "lastName", "email", "updatedAt", "phone") VALUES
        ('With', 'Phone', 'with@example.com', CURRENT_TIMESTAMP, '555-0100-123'),
        ('Without', 'Phone', 'without@example.com', CURRENT_TIMESTAMP, NULL)
    `)
    await seeder.$disconnect()

    harness.applyRemaining()

    const prisma = harness.connect()
    try {
      const rows = await prisma.$queryRawUnsafe<
        { firstName: string; phoneSource: string | null; phoneEnrichmentStatus: string }[]
      >(`SELECT "firstName", "phoneSource", "phoneEnrichmentStatus" FROM "lead" ORDER BY "id"`)
      expect(rows).toEqual([
        { firstName: 'With', phoneSource: 'IMPORT', phoneEnrichmentStatus: 'NOT_STARTED' },
        { firstName: 'Without', phoneSource: null, phoneEnrichmentStatus: 'NOT_STARTED' },
      ])
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)
})
