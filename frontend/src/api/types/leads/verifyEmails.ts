export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

/** The request returns as soon as verification has started; outcomes arrive on the leads list. */
export type LeadsVerifyEmailsOutput = {
  started: number[]
  failed: Array<{
    leadId: number
    error: string
  }>
}
