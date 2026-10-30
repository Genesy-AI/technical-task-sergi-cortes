import { isProviderId, PROVIDER_IDS, ProviderId } from './providerIds'

/** How to reach one provider. Keys are secrets and only ever come from the environment. */
export interface ProviderSettings {
  id: ProviderId
  apiKey: string
  baseUrl: string
  /** Calls per second across all workers, enforced by the Temporal server on the provider's task queue. */
  maxPerSecond?: number
}

export interface PhoneEnrichmentConfig {
  /** The providers to try, in order. */
  order: ProviderId[]
  /** Settings for the providers in `order`, in the same order. */
  providers: ProviderSettings[]
}

/** The documented endpoints. They are not secret, so they default here and `.env` can override them. */
const DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  ASTRA: 'https://api.enginy.ai/api/tmp/astraDialer',
  NIMBUS: 'https://api.enginy.ai/api/tmp/numbusLookup',
  ORION: 'https://api.enginy.ai/api/tmp/orionConnect',
}

const DEFAULT_ORDER: ProviderId[] = ['ASTRA', 'NIMBUS', 'ORION']

/** Lists every configuration problem at once, so one restart is enough to fix them all. */
export class PhoneEnrichmentConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid phone enrichment configuration: ${problems.join('; ')}`)
    this.name = 'PhoneEnrichmentConfigError'
  }
}

function parseOrder(raw: string | undefined, problems: string[]): ProviderId[] {
  if (raw === undefined) return DEFAULT_ORDER

  const names = raw
    .split(',')
    .map((name) => name.trim().toUpperCase())
    .filter(Boolean)
  if (names.length === 0) {
    problems.push('PHONE_PROVIDER_ORDER must list at least one provider')
    return []
  }

  const order: ProviderId[] = []
  for (const name of names) {
    if (!isProviderId(name)) {
      problems.push(`PHONE_PROVIDER_ORDER has an unknown provider "${name}"; use ${PROVIDER_IDS.join(', ')}`)
    } else if (order.includes(name)) {
      problems.push(`PHONE_PROVIDER_ORDER lists ${name} more than once`)
    } else {
      order.push(name)
    }
  }
  return order
}

function parseBaseUrl(id: ProviderId, env: NodeJS.ProcessEnv, problems: string[]): string {
  const variable = `${id}_BASE_URL`
  const value = env[variable]?.trim() || DEFAULT_BASE_URLS[id]
  try {
    const { protocol } = new URL(value)
    if (protocol === 'http:' || protocol === 'https:') return value
  } catch {
    // Reported below.
  }
  problems.push(`${variable} must be an http or https URL`)
  return value
}

function parseMaxPerSecond(id: ProviderId, env: NodeJS.ProcessEnv, problems: string[]): number | undefined {
  const variable = `PHONE_${id}_MAX_PER_SECOND`
  const raw = env[variable]?.trim()
  if (!raw) return undefined

  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    problems.push(`${variable} must be a positive number`)
    return undefined
  }
  return value
}

/**
 * Reads and validates the phone enrichment configuration.
 * Only the providers in the order need a key, so a provider can be switched off by leaving it out.
 */
export function loadPhoneEnrichmentConfig(env: NodeJS.ProcessEnv = process.env): PhoneEnrichmentConfig {
  const problems: string[] = []
  const order = parseOrder(env.PHONE_PROVIDER_ORDER, problems)

  const providers = order.map((id): ProviderSettings => {
    const apiKey = env[`${id}_API_KEY`]?.trim() ?? ''
    if (!apiKey) problems.push(`${id}_API_KEY is required`)

    const settings: ProviderSettings = { id, apiKey, baseUrl: parseBaseUrl(id, env, problems) }
    const maxPerSecond = parseMaxPerSecond(id, env, problems)
    if (maxPerSecond !== undefined) settings.maxPerSecond = maxPerSecond
    return settings
  })

  if (problems.length > 0) throw new PhoneEnrichmentConfigError(problems)
  return { order, providers }
}
