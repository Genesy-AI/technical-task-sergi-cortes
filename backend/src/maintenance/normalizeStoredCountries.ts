import { PrismaClient } from '@prisma/client'
import { normalizeCountryCode } from '../utils/countryCode'

export interface CountryChange {
  id: number
  name: string
  from: string | null
  to: string | null
}

/**
 * Converts stored lead countries with the same rules as the import.
 * Returns the changes it found, and writes them only when `apply` is true.
 * Valid values convert to themselves, so running it again finds nothing to change.
 */
export async function normalizeStoredCountries(
  prisma: PrismaClient,
  { apply }: { apply: boolean }
): Promise<CountryChange[]> {
  const leads = await prisma.lead.findMany({
    where: { countryCode: { not: null } },
    select: { id: true, firstName: true, lastName: true, countryCode: true },
    orderBy: { id: 'asc' },
  })

  const changes = leads
    .map((lead) => ({
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`,
      from: lead.countryCode,
      to: normalizeCountryCode(lead.countryCode).code,
    }))
    .filter((change) => change.from !== change.to)

  if (apply && changes.length > 0) {
    await prisma.$transaction(
      changes.map((change) =>
        prisma.lead.update({ where: { id: change.id }, data: { countryCode: change.to } })
      )
    )
  }

  return changes
}
