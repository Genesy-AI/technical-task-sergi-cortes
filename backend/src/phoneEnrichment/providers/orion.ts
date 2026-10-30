import { businessDomain } from '../businessDomain'
import { PhoneProvider, readPhoneField } from './types'

/** Orion Connect: looks up by name and company website, which comes from a business email's domain. */
export const orion: PhoneProvider<{ fullName: string; companyWebsite: string }> = {
  id: 'ORION',

  inputFrom: (lead) => {
    const companyWebsite = businessDomain(lead.email)
    if (!companyWebsite) return { skip: 'no business domain' }
    return { input: { fullName: `${lead.firstName} ${lead.lastName}`.trim(), companyWebsite } }
  },

  request: (input, { apiKey, baseUrl }) => ({
    url: baseUrl,
    headers: { 'x-auth-me': apiKey },
    body: input,
  }),

  normalize: (body) => {
    const phone = readPhoneField(body.phone, 'phone')
    return phone ? { phone } : { notFound: true }
  },
}
