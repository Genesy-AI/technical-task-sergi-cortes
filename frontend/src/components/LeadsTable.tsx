import { IconBrandLinkedin } from '@tabler/icons-react'
import { FC, ReactNode } from 'react'
import { LeadFieldDefinition } from '../api/types/leads/getFields'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'

type Lead = LeadsGetManyOutput[number]

interface LeadsTableProps {
  leads: Lead[]
  columns: readonly LeadFieldDefinition[]
  selectedLeads: number[]
  onSelectAll: (checked: boolean) => void
  onSelectLead: (leadId: number, checked: boolean) => void
  /** The email cell carries verification state and actions owned by the leads list. */
  renderEmail: (lead: Lead) => ReactNode
}

const Blank = () => <span className="text-gray-400">-</span>

const isBlank = (value: unknown) => value === null || value === undefined || value === ''

/** `x123` extensions become the RFC 3966 `;ext=123` form that dialers understand. */
const telHref = (phone: string) =>
  `tel:${phone.replace(/\s+/g, '').replace(/(?:x|ext\.?)(\d+)$/i, ';ext=$1')}`

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const fullName = (lead: Lead) => `${lead.firstName} ${lead.lastName ?? ''}`.trim()

/** Renders one lead value according to its field type. */
const renderCell = (lead: Lead, column: LeadFieldDefinition, renderEmail: LeadsTableProps['renderEmail']) => {
  if (column.key === 'email') return renderEmail(lead)

  const value = (lead as Record<string, unknown>)[column.key]
  if (isBlank(value)) return <Blank />

  switch (column.type) {
    case 'phone':
      return (
        <a href={telHref(String(value))} className="text-gray-900 hover:text-blue-600 hover:underline">
          {String(value)}
        </a>
      )
    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`LinkedIn profile of ${fullName(lead)}`}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
        >
          <IconBrandLinkedin className="h-4 w-4" aria-hidden />
          Profile
        </a>
      )
    case 'date':
      return <span className="text-gray-500">{formatDate(String(value))}</span>
    default:
      return (
        <div className="max-w-56 truncate" title={String(value)}>
          {String(value)}
        </div>
      )
  }
}

const headerClass =
  'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50'

/** A divider plus a soft shadow on the pinned name column, so scrolled content visibly slides under it. */
const pinnedEdge = 'shadow-[inset_-1px_0_0_var(--color-gray-200),6px_0_8px_-6px_rgb(0_0_0/0.15)]'

/**
 * The leads table: columns come from the field registry, and the selection and name columns stay in view
 * while the rest scrolls horizontally.
 */
export const LeadsTable: FC<LeadsTableProps> = ({
  leads,
  columns,
  selectedLeads,
  onSelectAll,
  onSelectLead,
  renderEmail,
}) => {
  const isAllSelected = leads.length > 0 && selectedLeads.length === leads.length
  const isIndeterminate = selectedLeads.length > 0 && selectedLeads.length < leads.length

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          <th scope="col" className="sticky left-0 z-10 w-12 min-w-12 px-6 py-3 bg-gray-50">
            <input
              type="checkbox"
              aria-label="Select all leads"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
          </th>
          <th scope="col" className={`${headerClass} sticky left-12 z-10 ${pinnedEdge}`}>
            Name
          </th>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={`${headerClass} whitespace-nowrap`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {leads.map((lead) => {
          const isSelected = selectedLeads.includes(lead.id)
          // Sticky cells need an opaque background that follows the row's selection and hover state.
          const rowBackground = isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'
          return (
            <tr key={lead.id} className="group">
              <td className={`sticky left-0 z-[1] w-12 min-w-12 px-6 py-4 ${rowBackground}`}>
                <input
                  type="checkbox"
                  aria-label={`Select ${fullName(lead)}`}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={isSelected}
                  onChange={(e) => onSelectLead(lead.id, e.target.checked)}
                />
              </td>
              <td
                className={`sticky left-12 z-[1] px-6 py-4 whitespace-nowrap ${pinnedEdge} ${rowBackground}`}
              >
                <div className="text-sm font-medium text-gray-900">{fullName(lead)}</div>
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${rowBackground}`}
                >
                  {renderCell(lead, column, renderEmail)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
