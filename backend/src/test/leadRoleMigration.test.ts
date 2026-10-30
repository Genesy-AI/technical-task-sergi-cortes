import { afterAll, describe, expect, it } from 'vitest'
import { migratedUpTo } from './migrations'

/** The last migration before role history and the new profile fields existed. */
const harness = migratedUpTo('20261030090000_replace_email_verified_with_status')
afterAll(() => harness.cleanup())

describe('lead profile and role history migration', () => {
  it('gives every existing lead one current role copied from its job title and company', async () => {
    const seeder = harness.connect()
    await seeder.$executeRawUnsafe(`
      INSERT INTO "lead" ("firstName", "lastName", "email", "updatedAt", "jobTitle", "companyName") VALUES
        ('Ada', 'Lovelace', 'ada@acme.com', CURRENT_TIMESTAMP, 'Engineer', 'Acme'),
        ('Alan', 'Turing', 'alan@example.com', CURRENT_TIMESTAMP, NULL, NULL)
    `)
    await seeder.$disconnect()

    harness.applyRemaining()

    const prisma = harness.connect()
    try {
      const roles = await prisma.$queryRawUnsafe<
        {
          email: string
          position: number
          jobTitle: string | null
          companyName: string | null
          yearsInRole: number | null
          isCurrent: number
        }[]
      >(`
        SELECT l."email", r."position", r."jobTitle", r."companyName", r."yearsInRole", r."isCurrent"
        FROM "leadRole" r JOIN "lead" l ON l."id" = r."leadId" ORDER BY l."id"
      `)
      expect(
        roles.map((r) => ({ ...r, isCurrent: Boolean(r.isCurrent), position: Number(r.position) }))
      ).toEqual([
        {
          email: 'ada@acme.com',
          position: 0,
          jobTitle: 'Engineer',
          companyName: 'Acme',
          yearsInRole: null,
          isCurrent: true,
        },
        {
          email: 'alan@example.com',
          position: 0,
          jobTitle: null,
          companyName: null,
          yearsInRole: null,
          isCurrent: true,
        },
      ])

      const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("lead")`)
      expect(columns.map((c) => c.name)).toEqual(expect.arrayContaining(['phone', 'linkedinUrl']))
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)
})
