import { LeadFieldDefinition } from '../api/types/leads/getFields'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'

export interface MissingField {
  key: string
  label: string
  missing: number
  total: number
}

export interface TemplateCoverage {
  /** Placeholders that are not templatable fields; the backend would reject them. */
  unknown: string[]
  /** Used fields that some selected leads lack; those leads will get no message. */
  missing: MissingField[]
}

const PLACEHOLDER = /\{(\w+)\}/g
const isBlank = (value: unknown) => value === null || value === undefined || value === ''

/** Mirrors the backend generator's rules so the user sees, before generating, which leads will be skipped. */
export function templateCoverage(
  template: string,
  fields: readonly LeadFieldDefinition[],
  leads: LeadsGetManyOutput
): TemplateCoverage {
  const templatable = new Map(fields.filter((f) => f.templatable).map((f) => [f.key, f]))
  const used = [...new Set([...template.matchAll(PLACEHOLDER)].map(([, key]) => key))]

  return {
    unknown: used.filter((key) => !templatable.has(key)),
    missing: used
      .filter((key) => templatable.has(key))
      .map((key) => ({
        key,
        label: templatable.get(key)!.label,
        missing: leads.filter((lead) => isBlank((lead as Record<string, unknown>)[key])).length,
        total: leads.length,
      }))
      .filter((field) => field.missing > 0),
  }
}
