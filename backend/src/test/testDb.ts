import { PrismaClient } from '@prisma/client'
import { copyFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { inject } from 'vitest'

export interface TestDb {
  prisma: PrismaClient
  /** Deletes every lead, so each test starts from an empty table. */
  reset: () => Promise<void>
  close: () => Promise<void>
}

/** Creates an isolated copy of the migrated template database for one test file. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(path.join(tmpdir(), 'tinyenginy-db-'))
  const dbPath = path.join(dir, 'test.db')
  copyFileSync(inject('templateDbPath'), dbPath)

  const prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` })

  return {
    prisma,
    reset: async () => {
      await prisma.lead.deleteMany()
    },
    close: async () => {
      await prisma.$disconnect()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
