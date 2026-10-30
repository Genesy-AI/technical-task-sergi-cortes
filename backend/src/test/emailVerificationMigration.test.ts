import { afterAll, describe, expect, it } from 'vitest'
import { migratedUpTo } from './migrations'

/** The last migration before the email verification status existed. */
const harness = migratedUpTo('20250905104559_add_email_verified_column')
afterAll(() => harness.cleanup())

describe('email verification status migration', () => {
  it('maps verified, not verified, and never checked leads to statuses', async () => {
    const seeder = harness.connect()
    await seeder.$executeRawUnsafe(`
      INSERT INTO "lead" ("firstName", "lastName", "email", "updatedAt", "emailVerified") VALUES
        ('Verified', 'Lead', 'verified@example.com', CURRENT_TIMESTAMP, 1),
        ('Invalid', 'Lead', 'invalid@example.com', CURRENT_TIMESTAMP, 0),
        ('Unchecked', 'Lead', 'unchecked@example.com', CURRENT_TIMESTAMP, NULL)
    `)
    // Close before migrating: a connection opened on the old table reports stale column names.
    await seeder.$disconnect()

    harness.applyRemaining()

    const prisma = harness.connect()
    try {
      const rows = await prisma.$queryRawUnsafe<{ firstName: string; emailVerificationStatus: string }[]>(
        `SELECT "firstName", "emailVerificationStatus" FROM "lead" ORDER BY "id"`
      )
      expect(rows).toEqual([
        { firstName: 'Verified', emailVerificationStatus: 'VERIFIED' },
        { firstName: 'Invalid', emailVerificationStatus: 'INVALID' },
        { firstName: 'Unchecked', emailVerificationStatus: 'UNVERIFIED' },
      ])

      const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("lead")`)
      expect(columns.map((c) => c.name)).not.toContain('emailVerified')
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)
})
