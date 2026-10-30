import { IconColumns } from '@tabler/icons-react'
import { FC, useEffect, useRef, useState } from 'react'
import { LeadFieldDefinition } from '../api/types/leads/getFields'

interface ColumnMenuProps {
  columns: readonly LeadFieldDefinition[]
  isVisible: (key: string) => boolean
  onToggle: (key: string) => void
}

/** Lets the user choose which lead fields the table shows; closes on outside click or Escape. */
export const ColumnMenu: FC<ColumnMenuProps> = ({ columns, isVisible, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setIsOpen(false)
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <IconColumns className="w-4 h-4 mr-2" aria-hidden />
        Columns
      </button>
      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Show columns
          </div>
          {columns.map((column) => (
            <label
              key={column.key}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={isVisible(column.key)}
                onChange={() => onToggle(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
