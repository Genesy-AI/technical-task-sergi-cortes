import { Prisma } from '@prisma/client'
import { yearsAtCompany } from './importLeads'

/** Loads a lead's roles in file order, for every read that shows or templates profile data. */
export const withRoles = { roles: { orderBy: { position: 'asc' } } } satisfies Prisma.leadInclude

export type LeadWithRoles = Prisma.leadGetPayload<{ include: typeof withRoles }>

/**
 * The lead as the API and the message generator see it: stored fields, roles in order,
 * and the values derived from the current role, calculated on read so they always match the roles.
 */
export function toLeadView(lead: LeadWithRoles) {
  const current = lead.roles.find((role) => role.isCurrent)
  return {
    ...lead,
    roles: lead.roles.map(({ position, jobTitle, companyName, yearsInRole, isCurrent }) => ({
      position,
      jobTitle,
      companyName,
      yearsInRole,
      isCurrent,
    })),
    yearsInRole: current?.yearsInRole ?? null,
    yearsAtCompany: yearsAtCompany(lead.roles, lead.companyName),
  }
}

export type LeadView = ReturnType<typeof toLeadView>
