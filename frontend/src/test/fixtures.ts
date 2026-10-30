import { LeadFieldDefinition } from '../api/types/leads/getFields'
import { EmailVerificationStatus, LeadsGetManyOutput } from '../api/types/leads/getMany'

type Lead = LeadsGetManyOutput[number]

/** A lead as GET /leads returns it, with sensible defaults. */
export const leadFixture = (
  id: number,
  firstName: string,
  status: EmailVerificationStatus = 'UNVERIFIED',
  overrides: Partial<Lead> = {}
): Lead => ({
  id,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
  firstName,
  lastName: 'Test',
  email: `${firstName.toLowerCase()}@example.com`,
  jobTitle: null,
  countryCode: null,
  companyName: null,
  message: null,
  emailVerificationStatus: status,
  phone: null,
  linkedinUrl: null,
  roles: [],
  yearsInRole: null,
  yearsAtCompany: null,
  phoneSource: null,
  phoneEnrichmentStatus: 'NOT_STARTED',
  phoneEnrichmentProgress: null,
  phoneEnrichmentAttempts: null,
  phoneEnrichedAt: null,
  ...overrides,
})

/** The field registry as GET /leads/fields returns it (mirrors backend/src/leads/leadFields.ts). */
export const fieldsFixture: LeadFieldDefinition[] = [
  { key: 'firstName', label: 'First name', group: 'Person', type: 'text', templatable: true, column: null },
  { key: 'lastName', label: 'Last name', group: 'Person', type: 'text', templatable: true, column: null },
  { key: 'email', label: 'Email', group: 'Contact', type: 'email', templatable: true, column: 'visible' },
  { key: 'phone', label: 'Phone', group: 'Contact', type: 'phone', templatable: true, column: 'visible' },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    group: 'Contact',
    type: 'url',
    templatable: true,
    column: 'available',
  },
  {
    key: 'countryCode',
    label: 'Country',
    group: 'Person',
    type: 'country',
    templatable: true,
    column: 'visible',
  },
  { key: 'jobTitle', label: 'Job title', group: 'Role', type: 'text', templatable: true, column: 'visible' },
  {
    key: 'companyName',
    label: 'Company',
    group: 'Company',
    type: 'text',
    templatable: true,
    column: 'visible',
  },
  {
    key: 'yearsInRole',
    label: 'Years in role',
    group: 'Role',
    type: 'number',
    templatable: true,
    column: 'available',
  },
  {
    key: 'yearsAtCompany',
    label: 'Years at company',
    group: 'Company',
    type: 'number',
    templatable: true,
    column: 'available',
  },
  { key: 'message', label: 'Message', group: 'Record', type: 'text', templatable: false, column: 'visible' },
  {
    key: 'createdAt',
    label: 'Created',
    group: 'Record',
    type: 'date',
    templatable: false,
    column: 'available',
  },
]
