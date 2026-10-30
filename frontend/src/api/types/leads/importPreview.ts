/** One CSV row exactly as parsed: column header as in the file, mapped to the cell text. */
export type CsvRow = Record<string, string>

export type LeadsImportPreviewInput = {
  rows: CsvRow[]
}

/** A note about one value, tied to its 1-based data row in the file. */
export type ImportNote = {
  rowNumber: number
  field: string
  message: string
}

export type PlannedRole = {
  rowNumber: number
  jobTitle: string | null
  companyName: string | null
  yearsInRole: number | null
  isCurrent: boolean
}

export type PlannedLead = {
  /** `duplicate` when a lead with this email already exists; it will be skipped. */
  status: 'new' | 'duplicate'
  email: string
  firstName: string
  lastName: string
  phone: string | null
  linkedinUrl: string | null
  countryCode: string | null
  jobTitle: string | null
  companyName: string | null
  yearsInRole: number | null
  yearsAtCompany: number | null
  roles: PlannedRole[]
  rowNumbers: number[]
  notes: ImportNote[]
}

export type InvalidRow = {
  rowNumber: number
  errors: string[]
  firstName: string
  lastName: string
  email: string
}

/** What the import would store, computed by the backend with the same rules as the import itself. */
export type LeadsImportPreviewOutput = {
  totalRows: number
  leads: PlannedLead[]
  invalidRows: InvalidRow[]
}
