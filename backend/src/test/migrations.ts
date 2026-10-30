import { PrismaClient } from '@prisma/client'
import { execFileSync } from 'child_process'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const backendRoot = path.resolve(__dirname, '../..')
const migrationsDir = path.join(backendRoot, 'prisma/migrations')

export interface MigrationHarness {
  /** Opens a client on the scratch database; close it before migrating again. */
  connect: () => PrismaClient
  /** Applies every migration after the starting one. */
  applyRemaining: () => void
  cleanup: () => void
}

/**
 * Builds a scratch SQLite database migrated up to and including `lastMigration`,
 * so a test can seed rows in the old shape and then apply the migrations under test.
 */
export function migratedUpTo(lastMigration: string): MigrationHarness {
  const dir = mkdtempSync(path.join(tmpdir(), 'tinyenginy-migration-'))
  const dbPath = path.join(dir, 'test.db')
  writeFileSync(
    path.join(dir, 'schema.prisma'),
    readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8').replace(
      /url\s*=\s*"file:[^"]*"/,
      `url = "file:${dbPath}"`
    )
  )

  const copyMigrations = (include: (name: string) => boolean) => {
    for (const name of readdirSync(migrationsDir)) {
      if (name.endsWith('.toml') || include(name)) {
        cpSync(path.join(migrationsDir, name), path.join(dir, 'migrations', name), { recursive: true })
      }
    }
  }
  const deploy = () =>
    execFileSync(
      path.join(backendRoot, 'node_modules/.bin/prisma'),
      ['migrate', 'deploy', '--schema', path.join(dir, 'schema.prisma')],
      { cwd: backendRoot, stdio: 'pipe' }
    )

  copyMigrations((name) => name <= lastMigration)
  deploy()

  return {
    connect: () => new PrismaClient({ datasourceUrl: `file:${dbPath}` }),
    applyRemaining: () => {
      copyMigrations((name) => name > lastMigration)
      deploy()
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
