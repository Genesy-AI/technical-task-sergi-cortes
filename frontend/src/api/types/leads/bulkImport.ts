import { CsvRow } from './importPreview'

/** The raw rows of the file; the backend maps, groups, and validates them. */
export interface LeadsBulkImportInput {
  rows: CsvRow[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidRows: number
  errors: Array<{
    email: string
    error: string
  }>
}
