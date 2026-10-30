import { PrismaClient } from '@prisma/client'
import { normalizeStoredCountries } from './normalizeStoredCountries'

/**
 * Usage: pnpm db:normalize-countries [--apply]
 * Without --apply it only prints what would change.
 */
async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()

  try {
    const changes = await normalizeStoredCountries(prisma, { apply })
    const mode = apply ? 'Applied' : 'Dry run, nothing written'

    console.log(`${mode}: ${changes.length} lead country value(s) ${apply ? 'changed' : 'would change'}.`)
    for (const change of changes) {
      console.log(`  #${change.id} ${change.name}: ${change.from} -> ${change.to ?? '(blank)'}`)
    }
    if (!apply && changes.length > 0) console.log('Run again with --apply to write these changes.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
