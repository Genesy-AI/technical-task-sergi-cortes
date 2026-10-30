import Papa from 'papaparse'
import { CsvRow } from '../api/types/leads/importPreview'

/**
 * Turns CSV text into rows keyed by the headers as written in the file.
 * Mapping headers to fields, grouping people, and validating values happen in the backend,
 * so the preview and the import share one set of rules.
 */
export const readCsvRows = (content: string): CsvRow[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim(),
    quoteChar: '"',
  })

  const critical = result.errors.find(
    (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
  )
  if (critical) {
    throw new Error(`CSV parsing failed: ${critical.message}`)
  }

  if (!result.data || result.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  return result.data
}
