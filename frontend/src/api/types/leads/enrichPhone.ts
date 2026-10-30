export type LeadsEnrichPhoneInput = {
  leadIds: number[]
  /** Replace phones that already exist; without it, leads with a phone are skipped. */
  force?: boolean
}

/** The request returns as soon as lookups have started; outcomes arrive on the leads list. */
export type LeadsEnrichPhoneOutput = {
  started: number[]
  skipped: Array<{ leadId: number; reason: 'HAS_PHONE' }>
  failed: Array<{ leadId: number; error: string }>
}
