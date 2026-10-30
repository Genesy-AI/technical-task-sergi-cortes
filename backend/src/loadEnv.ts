import { loadEnvFileIfPresent } from './env'

// Imported first by the entry point, so modules that read `process.env` when loaded already see `backend/.env`.
loadEnvFileIfPresent()
