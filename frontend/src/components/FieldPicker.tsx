import { IconSearch } from '@tabler/icons-react'
import { FC, useMemo, useState } from 'react'
import { LeadFieldDefinition, LeadFieldGroup } from '../api/types/leads/getFields'

const GROUP_ORDER: LeadFieldGroup[] = ['Person', 'Contact', 'Company', 'Role', 'Record']

interface FieldPickerProps {
  /** Only templatable fields are offered. */
  fields: readonly LeadFieldDefinition[]
  onInsert: (key: string) => void
}

/** A searchable, grouped list of template fields that scales as the field registry grows. */
export const FieldPicker: FC<FieldPickerProps> = ({ fields, onInsert }) => {
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = fields.filter(
      (field) =>
        field.templatable &&
        (!term || field.label.toLowerCase().includes(term) || field.key.toLowerCase().includes(term))
    )
    return GROUP_ORDER.map((group) => ({
      group,
      fields: matching.filter((field) => field.group === group),
    })).filter((entry) => entry.fields.length > 0)
  }, [fields, search])

  return (
    <div role="group" aria-label="Insert a field" className="rounded-md border border-gray-200">
      <div className="relative border-b border-gray-200">
        <IconSearch
          className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Search fields"
          placeholder="Search fields"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-t-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        />
      </div>
      <div className="max-h-40 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-1 py-2 text-sm text-gray-500">{`No field matches "${search.trim()}"`}</p>
        ) : (
          groups.map(({ group, fields: groupFields }) => (
            <div key={group} className="mb-2 last:mb-0">
              <h3 className="px-1 pb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                {group}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {groupFields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => onInsert(field.key)}
                    title={`Insert {${field.key}}`}
                    className="inline-flex items-center gap-1.5 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    {field.label}
                    <code className="text-[11px] text-blue-600">{`{${field.key}}`}</code>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
