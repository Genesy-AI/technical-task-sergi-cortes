export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: LeadsBulkImportInput['leads'][number]
    error: string
  }>
}
