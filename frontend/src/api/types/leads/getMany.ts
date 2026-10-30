export type LeadsGetManyInput = undefined

/**
 * - `UNVERIFIED`: never checked.
 * - `PENDING`: a verification is running.
 * - `VERIFIED` / `INVALID`: the check accepted or rejected the email.
 * - `FAILED`: the check could not complete; it can be retried.
 */
export type EmailVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'INVALID' | 'FAILED'

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerificationStatus: EmailVerificationStatus
}[]
