import { PhoneProvider } from '../api/types/leads/getMany'

/** Mirrors the backend provider catalog (backend/src/phoneEnrichment/catalog.ts). */
export const PROVIDER_LABELS: Record<PhoneProvider, string> = {
  ASTRA: 'Astra Dialer',
  NIMBUS: 'Nimbus Lookup',
  ORION: 'Orion Connect',
}

/** `x123` extensions become the RFC 3966 `;ext=123` form that dialers understand. */
export const telHref = (phone: string) =>
  `tel:${phone.replace(/\s+/g, '').replace(/(?:x|ext\.?)(\d+)$/i, ';ext=$1')}`
