import { execFileSync } from 'child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import type { TestProject } from 'vitest/node'

const backendRoot = path.resolve(__dirname, '../..')

/**
 * Builds one migrated SQLite template database from the real Prisma migrations.
 * Test files copy it, so every file gets an isolated database and dev.db is never touched.
 */
export default function setup(project: TestProject) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tinyenginy-test-'))
  const templateDbPath = path.join(dir, 'template.db')

  cpSync(path.join(backendRoot, 'prisma/migrations'), path.join(dir, 'migrations'), { recursive: true })
  const schema = readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8').replace(
    /url\s*=\s*"file:[^"]*"/,
    `url = "file:${templateDbPath}"`
  )
  writeFileSync(path.join(dir, 'schema.prisma'), schema)

  execFileSync(
    path.join(backendRoot, 'node_modules/.bin/prisma'),
    ['migrate', 'deploy', '--schema', path.join(dir, 'schema.prisma')],
    { cwd: backendRoot, stdio: 'pipe' }
  )

  project.provide('templateDbPath', templateDbPath)

  return () => rmSync(dir, { recursive: true, force: true })
}

declare module 'vitest' {
  export interface ProvidedContext {
    templateDbPath: string
  }
}
