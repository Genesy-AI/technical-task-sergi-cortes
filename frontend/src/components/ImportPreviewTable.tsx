import { FC, ReactNode } from 'react'
import { InvalidRow, PlannedLead } from '../api/types/leads/importPreview'

const Blank = () => <span className="text-gray-400">-</span>
const or = (value: ReactNode) => (value === null || value === undefined || value === '' ? <Blank /> : value)

const STATUS_BADGE = {
  ready: { label: 'Ready', className: 'text-green-800 bg-green-100' },
  duplicate: { label: 'Already exists', className: 'text-amber-800 bg-amber-100' },
  invalid: { label: 'Invalid', className: 'text-red-800 bg-red-100' },
} as const

const StatusBadge: FC<{ status: keyof typeof STATUS_BADGE }> = ({ status }) => (
  <span
    className={`inline-flex whitespace-nowrap px-2 py-1 text-xs font-semibold rounded-full ${STATUS_BADGE[status].className}`}
  >
    {STATUS_BADGE[status].label}
  </span>
)

const NoteList: FC<{ items: string[]; tone: 'muted' | 'error' }> = ({ items, tone }) =>
  items.length === 0 ? (
    <Blank />
  ) : (
    <ul className={`space-y-0.5 text-xs ${tone === 'error' ? 'text-red-600' : 'text-amber-700'}`}>
      {items.map((item) => (
        <li key={item} className="whitespace-nowrap">
          {item}
        </li>
      ))}
    </ul>
  )

const COLUMNS = [
  'Rows',
  'Status',
  'Name',
  'Email',
  'Phone',
  'Company',
  'Country',
  'Roles',
  'Years at company',
  'Notes',
]

interface ImportPreviewTableProps {
  leads: PlannedLead[]
  invalidRows: InvalidRow[]
}

/** Shows, per person, what the import will store, and why rows were converted, cleared, merged, or rejected. */
export const ImportPreviewTable: FC<ImportPreviewTableProps> = ({ leads, invalidRows }) => (
  <div className="border border-gray-200 rounded-lg max-h-96 overflow-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          {COLUMNS.map((column) => (
            <th
              key={column}
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200 text-sm text-gray-900 align-top whitespace-nowrap">
        {leads.map((lead) => (
          <tr key={lead.email} className={lead.status === 'duplicate' ? 'bg-amber-50/50' : 'bg-white'}>
            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{lead.rowNumbers.join(', ')}</td>
            <td className="px-3 py-2">
              <StatusBadge status={lead.status === 'duplicate' ? 'duplicate' : 'ready'} />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              {lead.firstName} {lead.lastName}
            </td>
            <td className="px-3 py-2">{lead.email}</td>
            <td className="px-3 py-2 whitespace-nowrap">{or(lead.phone)}</td>
            <td className="px-3 py-2">{or(lead.companyName)}</td>
            <td className="px-3 py-2">{or(lead.countryCode)}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <div>{lead.roles.length === 1 ? '1 role' : `${lead.roles.length} roles`}</div>
              {lead.jobTitle && <div className="text-xs text-gray-500">{`Current: ${lead.jobTitle}`}</div>}
            </td>
            <td className="px-3 py-2">{or(lead.yearsAtCompany)}</td>
            <td className="px-3 py-2">
              <NoteList
                tone="muted"
                items={lead.notes.map((note) => `Row ${note.rowNumber}: ${note.message}`)}
              />
            </td>
          </tr>
        ))}
        {invalidRows.map((row) => (
          <tr key={`invalid-${row.rowNumber}`} className="bg-red-50">
            <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
            <td className="px-3 py-2">
              <StatusBadge status="invalid" />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{or(`${row.firstName} ${row.lastName}`.trim())}</td>
            <td className="px-3 py-2">{or(row.email)}</td>
            <td className="px-3 py-2" colSpan={5} />
            <td className="px-3 py-2">
              <NoteList tone="error" items={row.errors.map((error) => `Row ${row.rowNumber}: ${error}`)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
