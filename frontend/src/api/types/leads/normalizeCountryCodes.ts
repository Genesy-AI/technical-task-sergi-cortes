export type LeadsNormalizeCountryCodesInput = {
  values: string[]
}

/**
 * - `kept`: already a valid code.
 * - `converted`: rewritten to the code of the single country it identifies.
 * - `cleared`: not recognized, so the lead is stored without a country.
 * - `empty`: no value was given.
 */
export type CountryCodeOutcome = 'kept' | 'converted' | 'cleared' | 'empty'

export type NormalizedCountryCode = {
  value: string
  code: string | null
  outcome: CountryCodeOutcome
}

export type LeadsNormalizeCountryCodesOutput = {
  results: NormalizedCountryCode[]
}
