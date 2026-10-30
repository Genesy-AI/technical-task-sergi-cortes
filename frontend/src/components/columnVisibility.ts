import { useCallback, useMemo, useState } from 'react'
import { LeadFieldDefinition } from '../api/types/leads/getFields'

/** Versioned so a future change of column keys can start from the defaults instead of a stale choice. */
export const COLUMN_STORAGE_KEY = 'tinyenginy.leadsTable.visibleColumns.v1'

const readStoredKeys = (): string[] | null => {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null
    return Array.isArray(parsed) && parsed.every((key) => typeof key === 'string') ? parsed : null
  } catch {
    return null
  }
}

const storeKeys = (keys: string[]) => {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Storage can be blocked or full; the choice then lasts for this page view only.
  }
}

/**
 * Which registry columns the leads table shows, defaulting to the registry's `visible` columns
 * and remembering the user's choice in this browser.
 */
export function useColumnVisibility(fields: readonly LeadFieldDefinition[] | undefined) {
  const [chosenKeys, setChosenKeys] = useState<string[] | null>(readStoredKeys)

  const allColumns = useMemo(() => (fields ?? []).filter((field) => field.column !== null), [fields])
  const visibleKeys = useMemo(
    () =>
      new Set(
        chosenKeys ?? allColumns.filter((field) => field.column === 'visible').map((field) => field.key)
      ),
    [chosenKeys, allColumns]
  )
  const visibleColumns = useMemo(
    () => allColumns.filter((field) => visibleKeys.has(field.key)),
    [allColumns, visibleKeys]
  )

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(visibleKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const keys = allColumns.map((field) => field.key).filter((k) => next.has(k))
      setChosenKeys(keys)
      storeKeys(keys)
    },
    [allColumns, visibleKeys]
  )

  return { allColumns, visibleColumns, isVisible: (key: string) => visibleKeys.has(key), toggle }
}
