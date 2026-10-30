import { normalizeCountryCode } from '../utils/countryCode'
import {
  NormalizedValue,
  normalizeLinkedinUrl,
  normalizePhone,
  normalizeYearsInRole,
  ValueOutcome,
} from './values'

/** Where a field's value lives: on the person, on one of their roles, or calculated from roles. */
export type FieldLevel = 'person' | 'role' | 'derived' | 'system'
export type FieldGroup = 'Person' | 'Contact' | 'Company' | 'Role' | 'Record'
export type FieldType = 'text' | 'email' | 'phone' | 'url' | 'number' | 'country' | 'date'
/** `visible` columns show by default, `available` ones can be turned on, `null` fields are not table columns. */
export type ColumnDefault = 'visible' | 'available' | null

export interface LeadField {
  key: string
  label: string
  group: FieldGroup
  type: FieldType
  level: FieldLevel
  /** CSV header names, compared after lowercasing and removing everything but letters. */
  csvHeaders: readonly string[]
  /** Whether the message composer offers it and the generator accepts it as `{key}`. */
  templatable: boolean
  column: ColumnDefault
  normalize?: (input: unknown) => NormalizedValue<string | number>
}

const normalizeText = (input: unknown): NormalizedValue<string> => {
  const text = input == null ? '' : String(input).trim()
  if (!text) return { value: null, outcome: 'empty' }
  return { value: text, outcome: text === input ? 'kept' : 'converted' }
}

const normalizeCountry = (input: unknown): NormalizedValue<string> => {
  const text = input == null ? null : String(input)
  const { code, outcome } = normalizeCountryCode(text)
  const note = outcome === 'cleared' ? `${text?.trim()} is not a recognized country` : undefined
  return { value: code, outcome: outcome as ValueOutcome, ...(note && { note }) }
}

/**
 * Every lead field, declared once.
 * The import mapping, the message generator's allow-list, `GET /leads/fields`, and the table's columns derive from it,
 * so adding a field means one entry here plus the schema.
 */
export const LEAD_FIELDS: readonly LeadField[] = [
  {
    key: 'firstName',
    label: 'First name',
    group: 'Person',
    type: 'text',
    level: 'person',
    csvHeaders: ['firstname'],
    templatable: true,
    column: null,
    normalize: normalizeText,
  },
  {
    key: 'lastName',
    label: 'Last name',
    group: 'Person',
    type: 'text',
    level: 'person',
    csvHeaders: ['lastname'],
    templatable: true,
    column: null,
    normalize: normalizeText,
  },
  {
    key: 'email',
    label: 'Email',
    group: 'Contact',
    type: 'email',
    level: 'person',
    csvHeaders: ['email'],
    templatable: true,
    column: 'visible',
    normalize: normalizeText,
  },
  {
    key: 'phone',
    label: 'Phone',
    group: 'Contact',
    type: 'phone',
    level: 'person',
    csvHeaders: ['phonenumber', 'phone'],
    templatable: true,
    column: 'visible',
    normalize: normalizePhone,
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    group: 'Contact',
    type: 'url',
    level: 'person',
    csvHeaders: ['linkedinurl', 'linkedin', 'linkedinprofile'],
    templatable: true,
    column: 'available',
    normalize: normalizeLinkedinUrl,
  },
  {
    key: 'countryCode',
    label: 'Country',
    group: 'Person',
    type: 'country',
    level: 'person',
    csvHeaders: ['countrycode', 'country'],
    templatable: true,
    column: 'visible',
    normalize: normalizeCountry,
  },
  {
    key: 'jobTitle',
    label: 'Job title',
    group: 'Role',
    type: 'text',
    level: 'role',
    csvHeaders: ['jobtitle'],
    templatable: true,
    column: 'visible',
    normalize: normalizeText,
  },
  {
    key: 'companyName',
    label: 'Company',
    group: 'Company',
    type: 'text',
    level: 'role',
    csvHeaders: ['companyname', 'company'],
    templatable: true,
    column: 'visible',
    normalize: normalizeText,
  },
  {
    key: 'yearsInRole',
    label: 'Years in role',
    group: 'Role',
    type: 'number',
    level: 'role',
    csvHeaders: ['yearsinrole'],
    templatable: true,
    column: 'available',
    normalize: normalizeYearsInRole,
  },
  {
    key: 'yearsAtCompany',
    label: 'Years at company',
    group: 'Company',
    type: 'number',
    level: 'derived',
    csvHeaders: [],
    templatable: true,
    column: 'available',
  },
  {
    key: 'message',
    label: 'Message',
    group: 'Record',
    type: 'text',
    level: 'system',
    csvHeaders: [],
    templatable: false,
    column: 'visible',
  },
  {
    key: 'createdAt',
    label: 'Created',
    group: 'Record',
    type: 'date',
    level: 'system',
    csvHeaders: [],
    templatable: false,
    column: 'available',
  },
]

/** CSV header normalization shared by the import: lowercase and keep letters only. */
export const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '')

/** The CSV control column that marks a row's role as current; it is not a lead field. */
export const IS_CURRENT_ROLE_HEADER = 'iscurrentrole'

export const TEMPLATE_FIELD_KEYS: ReadonlySet<string> = new Set(
  LEAD_FIELDS.filter((field) => field.templatable).map((field) => field.key)
)

/** The public description of the fields, without the normalization functions. */
export const publicFieldDefinitions = () =>
  LEAD_FIELDS.map(({ key, label, group, type, templatable, column }) => ({
    key,
    label,
    group,
    type,
    templatable,
    column,
  }))
