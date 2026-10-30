import { PhoneProvider, readPhoneField } from './types'

/** Nimbus Lookup: needs the job title as well as the email, and authenticates with a query parameter. */
export const nimbus: PhoneProvider<{ email: string; jobTitle: string }> = {
  id: 'NIMBUS',

  inputFrom: (lead) => {
    const jobTitle = lead.jobTitle?.trim()
    return jobTitle ? { input: { email: lead.email, jobTitle } } : { skip: 'Missing job title' }
  },

  request: (input, { apiKey, baseUrl }) => {
    const url = new URL(baseUrl)
    url.searchParams.set('api', apiKey)
    return { url: url.toString(), headers: {}, body: input }
  },

  // The live endpoint answers `phoneNmbr` while its documentation says `number`, so both are read.
  normalize: (body) => {
    const phone = readPhoneField(
      body.phoneNmbr ?? body.number,
      body.phoneNmbr != null ? 'phoneNmbr' : 'number'
    )
    if (!phone) return { notFound: true }
    return typeof body.countryCode === 'string' ? { phone, country: body.countryCode } : { phone }
  },
}
