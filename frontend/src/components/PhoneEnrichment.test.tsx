import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { fieldsFixture, leadFixture } from '../test/fixtures'
import { pollIntervalFor } from './leadsPolling'
import { LeadsList } from './LeadsList'

vi.mock('../api', () => ({
  api: {
    leads: {
      getMany: vi.fn(),
      getFields: vi.fn(),
      verifyEmails: vi.fn(),
      deleteMany: vi.fn(),
      enrichPhone: vi.fn(),
    },
  },
}))

const getMany = vi.mocked(api.leads.getMany)
const enrichPhone = vi.mocked(api.leads.enrichPhone)

const renderList = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <LeadsList />
    </QueryClientProvider>
  )
}
const rowOf = async (name: string) => (await screen.findByText(`${name} Test`)).closest('tr')!

describe('phone enrichment in the leads table', () => {
  beforeEach(() => {
    localStorage.clear()
    getMany.mockReset()
    enrichPhone.mockReset()
    vi.mocked(api.leads.getFields).mockResolvedValue({ fields: fieldsFixture })
  })
  afterEach(() => vi.restoreAllMocks())

  it('starts lookups for the selected leads, closes the menu, and reports what started and what was skipped', async () => {
    getMany.mockResolvedValue([
      leadFixture(1, 'Ada'),
      leadFixture(2, 'Alan'),
      leadFixture(3, 'Grace', 'UNVERIFIED', { phone: '555-0100-123', phoneSource: 'IMPORT' }),
    ])
    enrichPhone.mockResolvedValue({
      started: [1, 2],
      skipped: [{ leadId: 3, reason: 'HAS_PHONE' }],
      failed: [],
    })
    renderList()

    for (const name of ['Ada', 'Alan', 'Grace']) {
      await userEvent.click(within(await rowOf(name)).getByRole('checkbox'))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Enrich' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enrich Phone' }))

    expect(enrichPhone).toHaveBeenCalledWith({ leadIds: [1, 2, 3] })
    expect(screen.queryByRole('button', { name: 'Enrich Phone' })).not.toBeInTheDocument()
    expect(await screen.findByText('Phone lookup started for 2 leads')).toBeInTheDocument()
    expect(await screen.findByText('1 lead already has a phone and was skipped')).toBeInTheDocument()
  })

  it('shows which provider is being tried while a lookup is pending', async () => {
    getMany.mockResolvedValue([
      leadFixture(1, 'Ada', 'UNVERIFIED', {
        phoneEnrichmentStatus: 'PENDING',
        phoneEnrichmentProgress: { provider: 'NIMBUS', position: 2, total: 3 },
      }),
    ])
    renderList()

    const row = await rowOf('Ada')
    expect(within(row).getByRole('status', { name: 'Trying Nimbus Lookup (2/3)' })).toBeInTheDocument()
  })

  it('shows a generic progress label before the first provider starts', async () => {
    getMany.mockResolvedValue([leadFixture(1, 'Ada', 'UNVERIFIED', { phoneEnrichmentStatus: 'PENDING' })])
    renderList()

    expect(within(await rowOf('Ada')).getByRole('status', { name: 'Looking up phone' })).toBeInTheDocument()
  })

  it('shows a found phone with the provider that found it', async () => {
    getMany.mockResolvedValue([
      leadFixture(1, 'Ada', 'UNVERIFIED', {
        phone: '+15550199000',
        phoneSource: 'ASTRA',
        phoneEnrichmentStatus: 'FOUND',
      }),
    ])
    renderList()

    const row = await rowOf('Ada')
    expect(within(row).getByRole('link', { name: '+15550199000' })).toBeInTheDocument()
    expect(within(row).getByText('via Astra Dialer')).toBeInTheDocument()
  })

  it('explains a lookup that found nothing, including skipped providers', async () => {
    getMany.mockResolvedValue([
      leadFixture(1, 'Ada', 'UNVERIFIED', {
        phoneEnrichmentStatus: 'NOT_FOUND',
        phoneEnrichmentAttempts: [
          { provider: 'ASTRA', result: 'NOT_FOUND' },
          { provider: 'NIMBUS', result: 'NOT_FOUND' },
          { provider: 'ORION', result: 'SKIPPED', reason: 'no business domain' },
        ],
      }),
    ])
    renderList()

    const notFound = within(await rowOf('Ada')).getByText('No data found')
    expect(notFound).toHaveAttribute(
      'title',
      'Astra Dialer: no phone\nNimbus Lookup: no phone\nOrion Connect: skipped, no business domain'
    )
  })

  it('offers to retry a failed lookup', async () => {
    getMany.mockResolvedValue([
      leadFixture(4, 'Ada', 'UNVERIFIED', {
        phoneEnrichmentStatus: 'FAILED',
        phoneEnrichmentAttempts: [
          { provider: 'ASTRA', result: 'ERRORED', error: 'Astra Dialer answered with status 500' },
        ],
      }),
    ])
    enrichPhone.mockResolvedValue({ started: [4], skipped: [], failed: [] })
    renderList()

    const row = await rowOf('Ada')
    expect(within(row).getByText('Lookup failed')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Retry phone lookup' }))

    expect(enrichPhone).toHaveBeenCalledWith({ leadIds: [4] })
  })

  it('re-enriches a lead that has a phone only after confirmation', async () => {
    getMany.mockResolvedValue([
      leadFixture(5, 'Ada', 'UNVERIFIED', { phone: '555-0100-123', phoneSource: 'IMPORT' }),
    ])
    enrichPhone.mockResolvedValue({ started: [5], skipped: [], failed: [] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderList()
    const button = within(await rowOf('Ada')).getByRole('button', { name: 'Re-enrich phone' })

    await userEvent.click(button)
    expect(enrichPhone).not.toHaveBeenCalled()

    await userEvent.click(button)
    expect(confirm).toHaveBeenCalledWith(
      'Replace 555-0100-123 with a phone from the providers, if one is found?'
    )
    expect(enrichPhone).toHaveBeenCalledWith({ leadIds: [5], force: true })
  })
})

describe('pollIntervalFor with phone lookups', () => {
  it('polls while a phone lookup is pending', () => {
    expect(pollIntervalFor([leadFixture(1, 'Ada', 'VERIFIED', { phoneEnrichmentStatus: 'PENDING' })])).toBe(
      2_000
    )
  })

  it('stops when no verification and no lookup is pending', () => {
    expect(pollIntervalFor([leadFixture(1, 'Ada', 'VERIFIED', { phoneEnrichmentStatus: 'FOUND' })])).toBe(
      false
    )
  })
})
