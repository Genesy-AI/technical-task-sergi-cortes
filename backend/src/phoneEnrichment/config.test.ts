import { describe, expect, it } from 'vitest'
import { loadPhoneEnrichmentConfig, PhoneEnrichmentConfigError } from './config'

const keys = { ASTRA_API_KEY: 'astra-key', NIMBUS_API_KEY: 'nimbus-key', ORION_API_KEY: 'orion-key' }

const problemsOf = (env: NodeJS.ProcessEnv): string[] => {
  try {
    loadPhoneEnrichmentConfig(env)
  } catch (error) {
    if (error instanceof PhoneEnrichmentConfigError) return error.problems
    throw error
  }
  throw new Error('expected the configuration to be rejected')
}

describe('loadPhoneEnrichmentConfig', () => {
  it('tries Astra, then Nimbus, then Orion by default, against the documented endpoints', () => {
    const config = loadPhoneEnrichmentConfig(keys)

    expect(config.order).toEqual(['ASTRA', 'NIMBUS', 'ORION'])
    expect(config.providers).toEqual([
      { id: 'ASTRA', apiKey: 'astra-key', baseUrl: 'https://api.enginy.ai/api/tmp/astraDialer' },
      { id: 'NIMBUS', apiKey: 'nimbus-key', baseUrl: 'https://api.enginy.ai/api/tmp/numbusLookup' },
      { id: 'ORION', apiKey: 'orion-key', baseUrl: 'https://api.enginy.ai/api/tmp/orionConnect' },
    ])
  })

  it('follows a configured order, ignoring case and spaces', () => {
    const config = loadPhoneEnrichmentConfig({ ...keys, PHONE_PROVIDER_ORDER: ' orion, Astra ' })

    expect(config.order).toEqual(['ORION', 'ASTRA'])
  })

  it('only requires keys for the providers in the order', () => {
    const config = loadPhoneEnrichmentConfig({ ASTRA_API_KEY: 'astra-key', PHONE_PROVIDER_ORDER: 'ASTRA' })

    expect(config.order).toEqual(['ASTRA'])
  })

  it('names every missing key', () => {
    expect(problemsOf({ NIMBUS_API_KEY: 'nimbus-key' })).toEqual([
      'ASTRA_API_KEY is required',
      'ORION_API_KEY is required',
    ])
  })

  it('treats a blank key as missing', () => {
    expect(problemsOf({ ...keys, ASTRA_API_KEY: '  ' })).toEqual(['ASTRA_API_KEY is required'])
  })

  it('reports the missing variable in the error message', () => {
    expect(() => loadPhoneEnrichmentConfig({ ...keys, ASTRA_API_KEY: undefined })).toThrow(/ASTRA_API_KEY/)
  })

  it.each([
    ['ASTRA,ZEUS', 'PHONE_PROVIDER_ORDER has an unknown provider "ZEUS"; use ASTRA, NIMBUS, ORION'],
    ['ASTRA,astra', 'PHONE_PROVIDER_ORDER lists ASTRA more than once'],
    [' , ', 'PHONE_PROVIDER_ORDER must list at least one provider'],
  ])('rejects the order %j', (order, problem) => {
    expect(problemsOf({ ...keys, PHONE_PROVIDER_ORDER: order })).toEqual([problem])
  })

  it('accepts base URL overrides and rejects invalid ones', () => {
    const config = loadPhoneEnrichmentConfig({ ...keys, ORION_BASE_URL: 'http://localhost:9999/orion' })
    expect(config.providers[2].baseUrl).toBe('http://localhost:9999/orion')

    expect(problemsOf({ ...keys, ORION_BASE_URL: 'ftp://example.com' })).toEqual([
      'ORION_BASE_URL must be an http or https URL',
    ])
  })

  it('reads optional per-provider rate limits', () => {
    const config = loadPhoneEnrichmentConfig({
      ...keys,
      PHONE_ORION_MAX_PER_SECOND: '1',
      PHONE_NIMBUS_MAX_PER_SECOND: '0.5',
    })

    expect(config.providers.map((p) => p.maxPerSecond)).toEqual([undefined, 0.5, 1])
  })

  it.each(['0', '-1', 'fast', 'Infinity'])('rejects the rate limit %j', (value) => {
    expect(problemsOf({ ...keys, PHONE_ASTRA_MAX_PER_SECOND: value })).toEqual([
      'PHONE_ASTRA_MAX_PER_SECOND must be a positive number',
    ])
  })
})
