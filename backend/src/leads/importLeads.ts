import { IS_CURRENT_ROLE_HEADER, LEAD_FIELDS, LeadField, normalizeHeader } from './leadFields'
import { isCurrentRoleFlag, NormalizedValue } from './values'

/** A preview note about one value, tied to the file row it came from (1-based, header excluded). */
export interface ImportNote {
  rowNumber: number
  field: string
  message: string
}

export interface PlannedRole {
  rowNumber: number
  jobTitle: string | null
  companyName: string | null
  yearsInRole: number | null
  isCurrent: boolean
}

export interface PlannedLead {
  /** `duplicate` when a lead with this email already exists; it is skipped on import. */
  status: 'new' | 'duplicate'
  email: string
  firstName: string
  lastName: string
  phone: string | null
  linkedinUrl: string | null
  countryCode: string | null
  /** Copies of the current role, as stored on the lead. */
  jobTitle: string | null
  companyName: string | null
  yearsInRole: number | null
  yearsAtCompany: number | null
  roles: PlannedRole[]
  rowNumbers: number[]
  notes: ImportNote[]
}

export interface InvalidRow {
  rowNumber: number
  errors: string[]
  firstName: string
  lastName: string
  email: string
}

export interface ImportPlan {
  /** Non-blank rows in the file. */
  totalRows: number
  leads: PlannedLead[]
  invalidRows: InvalidRow[]
}

interface ParsedRow {
  rowNumber: number
  cells: Map<string, string>
  isCurrent: boolean
}

const FIELD_BY_KEY = new Map(LEAD_FIELDS.map((field) => [field.key, field]))
const FIELD_BY_HEADER = new Map(
  LEAD_FIELDS.flatMap((field) => field.csvHeaders.map((header) => [header, field]))
)
const PERSON_FIELDS = ['firstName', 'lastName', 'phone', 'linkedinUrl', 'countryCode'].map(
  (key) => FIELD_BY_KEY.get(key)!
)
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Conversions worth telling the user about; whitespace trims are not. */
const NOTED_CONVERSION_TYPES = new Set(['country', 'url'])

const field = (key: string) => FIELD_BY_KEY.get(key)!
const normalized = (f: LeadField, raw: string | undefined): NormalizedValue<string | number> =>
  f.normalize!(raw)
const lower = (value: string | null) => (value ?? '').trim().toLowerCase()

/** Maps one raw CSV row onto field keys, ignoring unrecognized columns. */
function parseRow(raw: unknown, rowNumber: number): ParsedRow {
  const cells = new Map<string, string>()
  let isCurrent = false
  for (const [header, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const key = normalizeHeader(header)
    const text = value == null ? '' : String(value)
    if (key === IS_CURRENT_ROLE_HEADER) isCurrent = isCurrentRoleFlag(text)
    const target = FIELD_BY_HEADER.get(key)
    if (target && !cells.has(target.key)) cells.set(target.key, text)
  }
  return { rowNumber, cells, isCurrent }
}

function rowErrors(row: ParsedRow): string[] {
  const errors: string[] = []
  if (!row.cells.get('firstName')?.trim()) errors.push('First name is required')
  if (!row.cells.get('lastName')?.trim()) errors.push('Last name is required')
  const email = row.cells.get('email')?.trim()
  if (!email) errors.push('Email is required')
  else if (!EMAIL_FORMAT.test(email)) errors.push('Invalid email format')
  return errors
}

/** Picks the first non-blank value of a person-level field and notes rows that disagree. */
function personValue(f: LeadField, rows: ParsedRow[], notes: ImportNote[]): string | null {
  let chosen: { value: string; rowNumber: number } | undefined
  for (const row of rows) {
    const raw = row.cells.get(f.key)
    const result = normalized(f, raw)
    if (result.note) notes.push({ rowNumber: row.rowNumber, field: f.key, message: result.note })
    if (result.outcome === 'converted' && NOTED_CONVERSION_TYPES.has(f.type)) {
      notes.push({ rowNumber: row.rowNumber, field: f.key, message: `Converted from ${raw?.trim()}` })
    }
    if (result.value == null) continue

    const value = String(result.value)
    if (!chosen) chosen = { value, rowNumber: row.rowNumber }
    else if (value !== chosen.value) {
      notes.push({
        rowNumber: row.rowNumber,
        field: f.key,
        message: `Different ${f.label.toLowerCase()} ${value} ignored; using ${chosen.value} from row ${chosen.rowNumber}`,
      })
    }
  }
  return chosen?.value ?? null
}

/** Builds the roles in file order, merging identical rows so their years are not counted twice. */
function buildRoles(rows: ParsedRow[], notes: ImportNote[]): PlannedRole[] {
  const roles: PlannedRole[] = []
  const firstRowByRole = new Map<string, PlannedRole>()
  for (const row of rows) {
    const years = normalized(field('yearsInRole'), row.cells.get('yearsInRole'))
    if (years.note) notes.push({ rowNumber: row.rowNumber, field: 'yearsInRole', message: years.note })
    const role: PlannedRole = {
      rowNumber: row.rowNumber,
      jobTitle: normalized(field('jobTitle'), row.cells.get('jobTitle')).value as string | null,
      companyName: normalized(field('companyName'), row.cells.get('companyName')).value as string | null,
      yearsInRole: years.value as number | null,
      isCurrent: row.isCurrent,
    }

    const identity = [lower(role.jobTitle), lower(role.companyName), role.yearsInRole ?? ''].join('|')
    const existing = firstRowByRole.get(identity)
    if (existing) {
      existing.isCurrent ||= role.isCurrent
      notes.push({
        rowNumber: row.rowNumber,
        field: 'role',
        message: `Same role as row ${existing.rowNumber}, merged`,
      })
      continue
    }
    firstRowByRole.set(identity, role)
    roles.push(role)
  }
  return roles
}

/** Marks exactly one role current: the last marked one, or else the last in file order. */
function selectCurrentRole(roles: PlannedRole[], notes: ImportNote[]): PlannedRole {
  const marked = roles.filter((role) => role.isCurrent)
  const current = marked.at(-1) ?? roles.at(-1)!
  if (marked.length > 1) {
    notes.push({
      rowNumber: current.rowNumber,
      field: 'isCurrentRole',
      message: `Several rows are marked as current; using row ${current.rowNumber}`,
    })
  }
  for (const role of roles) role.isCurrent = role === current
  return current
}

/** Sums years over the roles at the current role's company; blank when none of them has years. */
export function yearsAtCompany(
  roles: readonly Pick<PlannedRole, 'companyName' | 'yearsInRole'>[],
  currentCompany: string | null
): number | null {
  const years = roles
    .filter((role) => lower(role.companyName) === lower(currentCompany) && role.yearsInRole != null)
    .map((role) => role.yearsInRole!)
  return years.length > 0 ? years.reduce((sum, value) => sum + value, 0) : null
}

function planLead(rows: ParsedRow[], existingEmails: ReadonlySet<string>): PlannedLead {
  const notes: ImportNote[] = []
  const email = rows[0].cells.get('email')!.trim()
  const [firstName, lastName, phone, linkedinUrl, countryCode] = PERSON_FIELDS.map((f) =>
    personValue(f, rows, notes)
  )
  const roles = buildRoles(rows, notes)
  const current = selectCurrentRole(roles, notes)

  return {
    status: existingEmails.has(email.toLowerCase()) ? 'duplicate' : 'new',
    email,
    firstName: firstName!,
    lastName: lastName!,
    phone,
    linkedinUrl,
    countryCode,
    jobTitle: current.jobTitle,
    companyName: current.companyName,
    yearsInRole: current.yearsInRole,
    yearsAtCompany: yearsAtCompany(roles, current.companyName),
    roles,
    rowNumbers: rows.map((row) => row.rowNumber),
    notes: notes.sort((a, b) => a.rowNumber - b.rowNumber),
  }
}

/**
 * Turns raw CSV rows, with headers exactly as in the file, into the leads an import would create.
 * Rows are grouped into people by email; each row becomes one of the person's roles.
 * The preview endpoint returns this plan and the bulk import executes it, so they cannot disagree.
 */
export function buildImport(rawRows: readonly unknown[], existingEmails: ReadonlySet<string>): ImportPlan {
  const people = new Map<string, ParsedRow[]>()
  const invalidRows: InvalidRow[] = []
  let totalRows = 0

  rawRows.forEach((raw, index) => {
    const row = parseRow(raw, index + 1)
    if ([...row.cells.values()].every((value) => !value.trim())) return
    totalRows++

    const errors = rowErrors(row)
    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        errors,
        firstName: row.cells.get('firstName')?.trim() ?? '',
        lastName: row.cells.get('lastName')?.trim() ?? '',
        email: row.cells.get('email')?.trim() ?? '',
      })
      return
    }

    const key = row.cells.get('email')!.trim().toLowerCase()
    people.set(key, [...(people.get(key) ?? []), row])
  })

  return {
    totalRows,
    leads: [...people.values()].map((rows) => planLead(rows, existingEmails)),
    invalidRows,
  }
}
