/**
 * What the workflow needs to know about each provider: no I/O and no large imports, so it is safe in the workflow sandbox.
 * How to call a provider lives in its module under `providers/`.
 */
export const PROVIDER_CATALOG = {
  ASTRA: { label: 'Astra Dialer', taskQueue: 'phone-astra', attemptTimeout: '5 seconds' },
  NIMBUS: { label: 'Nimbus Lookup', taskQueue: 'phone-nimbus', attemptTimeout: '8 seconds' },
  ORION: { label: 'Orion Connect', taskQueue: 'phone-orion', attemptTimeout: '10 seconds' },
} as const

export type ProviderId = keyof typeof PROVIDER_CATALOG

/** Every phone provider the backend knows, which also names its environment variables. */
export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG) as ProviderId[]

export const isProviderId = (value: string): value is ProviderId =>
  Object.prototype.hasOwnProperty.call(PROVIDER_CATALOG, value)
