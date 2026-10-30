export type LeadsGetFieldsInput = undefined

export type LeadFieldGroup = 'Person' | 'Contact' | 'Company' | 'Role' | 'Record'
export type LeadFieldType = 'text' | 'email' | 'phone' | 'url' | 'number' | 'country' | 'date'

/** One lead field as described by the backend registry. */
export type LeadFieldDefinition = {
  key: string
  label: string
  group: LeadFieldGroup
  type: LeadFieldType
  /** Whether the message composer offers it as `{key}`. */
  templatable: boolean
  /** `visible` columns show by default, `available` ones can be turned on, `null` is not a column. */
  column: 'visible' | 'available' | null
}

export type LeadsGetFieldsOutput = {
  fields: LeadFieldDefinition[]
}
