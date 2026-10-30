import { PhoneProvider, readPhoneField } from './types'

/** Astra Dialer: the fastest provider, looked up by email alone, so it never skips a lead. */
export const astra: PhoneProvider<{ email: string }> = {
  id: 'ASTRA',

  inputFrom: (lead) => ({ input: { email: lead.email } }),

  request: (input, { apiKey, baseUrl }) => ({
    url: baseUrl,
    headers: { apiKey },
    body: input,
  }),

  normalize: (body) => {
    const phone = readPhoneField(body.phoneNmbr, 'phoneNmbr')
    return phone ? { phone } : { notFound: true }
  },
}
