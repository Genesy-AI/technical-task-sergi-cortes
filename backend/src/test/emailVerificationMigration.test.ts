import { PrismaClient } from '@prisma/client'
import { execFileSync } from 'child_process'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'

const backendRoot = path.resolve(__dirname, '../..')
const migrationsDir = path.join(backendRoot, 'prisma/migrations')
/** The last migration before the email verification status existed. */
const LAST_BOOLEAN_MIGRATION = '20250905104559_add_email_verified_column'

const dir = mkdtempSync(path.join(tmpdir(), 'tinyenginy-migration-'))
const dbPath = path.join(dir, 'test.db')
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const deploy = () =>
  execFileSync(
    path.join(backendRoot, 'node_modules/.bin/prisma'),
    ['migrate', 'deploy', '--schema', path.join(dir, 'schema.prisma')],
    { cwd: backendRoot, stdio: 'pipe' }
  )

const copyMigrations = (include: (name: string) => boolean) => {
  for (const name of readdirSync(migrationsDir)) {
    if (name.endsWith('.toml') || include(name)) {
      cpSync(path.join(migrationsDir, name), path.join(dir, 'migrations', name), { recursive: true })
    }
  }
}

describe('email verification status migration', () => {
  it('maps verified, not verified, and never checked leads to statuses', async () => {
    writeFileSync(
      path.join(dir, 'schema.prisma'),
      readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8').replace(
        /url\s*=\s*"file:[^"]*"/,
        `url = "file:${dbPath}"`
      )
    )
    copyMigrations((name) => name <= LAST_BOOLEAN_MIGRATION)
    deploy()

    const seeder = new PrismaClient({ datasourceUrl: `file:${dbPath}` })
    await seeder.$executeRawUnsafe(`
      INSERT INTO "lead" ("firstName", "lastName", "email", "updatedAt", "emailVerified") VALUES
        ('Verified', 'Lead', 'verified@example.com', CURRENT_TIMESTAMP, 1),
        ('Invalid', 'Lead', 'invalid@example.com', CURRENT_TIMESTAMP, 0),
        ('Unchecked', 'Lead', 'unchecked@example.com', CURRENT_TIMESTAMP, NULL)
    `)
    // Close before migrating: a connection opened on the old table reports stale column names.
    await seeder.$disconnect()

    copyMigrations((name) => name > LAST_BOOLEAN_MIGRATION)
    deploy()

    const prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` })
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
