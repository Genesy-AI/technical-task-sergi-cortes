/** Every phone provider the backend knows, which also names its environment variables. */
export const PROVIDER_IDS = ['ASTRA', 'NIMBUS', 'ORION'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export const isProviderId = (value: string): value is ProviderId =>
  (PROVIDER_IDS as readonly string[]).includes(value)
