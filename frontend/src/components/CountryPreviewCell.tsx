import { FC } from 'react'
import { NormalizedCountryCode } from '../api/types/leads/normalizeCountryCodes'

interface CountryPreviewCellProps {
  /** The country exactly as it appears in the CSV row. */
  value?: string
  /** The backend's verdict for this value, once known. */
  result?: NormalizedCountryCode
  status: 'pending' | 'error' | 'success'
}

const Note: FC<{ tone: 'muted' | 'warning'; children: string }> = ({ tone, children }) => (
  <div className={`text-xs ${tone === 'warning' ? 'text-amber-700' : 'text-gray-500'}`}>{children}</div>
)

/** Shows the country the import will store for one CSV row, and why it differs from the file when it does. */
export const CountryPreviewCell: FC<CountryPreviewCellProps> = ({ value, result, status }) => {
  if (!value) return <span className="text-gray-400">-</span>

  if (status === 'pending') {
    return (
      <>
        <div>{value}</div>
        <Note tone="muted">Checking...</Note>
      </>
    )
  }

  if (status === 'error' || !result) {
    return (
      <>
        <div>{value}</div>
        <Note tone="warning">Could not check this country</Note>
      </>
    )
  }

  if (result.outcome === 'cleared') {
    return (
      <>
        <div className="text-gray-400">-</div>
        <Note tone="warning">{`${value} not recognized, left blank`}</Note>
      </>
    )
  }

  return (
    <>
      <div>{result.code}</div>
      {result.outcome === 'converted' && <Note tone="muted">{`Converted from ${value}`}</Note>}
    </>
  )
}
