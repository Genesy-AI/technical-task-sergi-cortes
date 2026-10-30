import type { ProviderId } from '../catalog'
import { astra } from './astra'
import { nimbus } from './nimbus'
import { orion } from './orion'
import type { PhoneProvider } from './types'

/**
 * Every provider's implementation, keyed by id, so the type checker catches a catalog entry without one.
 * Each provider's input type is erased here; `lookupPhone` only passes a provider's own input back to it.
 */
export const PROVIDERS: Record<ProviderId, PhoneProvider<any>> = {
  ASTRA: astra,
  NIMBUS: nimbus,
  ORION: orion,
}

export type { EnrichableLead, PhoneProvider } from './types'
