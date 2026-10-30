import { existsSync } from 'fs'
import path from 'path'

/** `backend/.env`, from both `src` under ts-node and `dist` after a build. */
export const DEFAULT_ENV_FILE = path.resolve(__dirname, '../.env')

/**
 * Loads a dotenv file into `process.env` when it exists, keeping variables the shell already set.
 * Returns whether a file was loaded, since running without one is valid when the shell provides everything.
 */
export function loadEnvFileIfPresent(file: string = DEFAULT_ENV_FILE): boolean {
  if (!existsSync(file)) return false
  process.loadEnvFile(file)
  return true
}
