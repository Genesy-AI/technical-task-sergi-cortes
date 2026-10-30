import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { loadEnvFileIfPresent } from './env'

const dir = mkdtempSync(path.join(tmpdir(), 'tinyenginy-env-'))
const VARIABLE = 'TINYENGINY_ENV_TEST_VALUE'

afterEach(() => {
  delete process.env[VARIABLE]
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('loadEnvFileIfPresent', () => {
  it('loads variables from the file when it exists', () => {
    const file = path.join(dir, 'present.env')
    writeFileSync(file, `${VARIABLE}=from-file\n`)

    expect(loadEnvFileIfPresent(file)).toBe(true)
    expect(process.env[VARIABLE]).toBe('from-file')
  })

  it('keeps variables already set in the environment', () => {
    const file = path.join(dir, 'keep.env')
    writeFileSync(file, `${VARIABLE}=from-file\n`)
    process.env[VARIABLE] = 'from-shell'

    loadEnvFileIfPresent(file)

    expect(process.env[VARIABLE]).toBe('from-shell')
  })

  it('does nothing when the file is missing', () => {
    expect(loadEnvFileIfPresent(path.join(dir, 'missing.env'))).toBe(false)
  })
})
