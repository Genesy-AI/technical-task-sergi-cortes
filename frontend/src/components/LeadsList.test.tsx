import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { EmailVerificationStatus } from '../api/types/leads/getMany'
import { fieldsFixture, leadFixture } from '../test/fixtures'
import { LeadsList } from './LeadsList'
import { pollIntervalFor } from './leadsPolling'

vi.mock('../api', () => ({
  api: { leads: { getMany: vi.fn(), getFields: vi.fn(), verifyEmails: vi.fn(), deleteMany: vi.fn() } },
}))

const getMany = vi.mocked(api.leads.getMany)
const verifyEmails = vi.mocked(api.leads.verifyEmails)
vi.mocked(api.leads.getFields).mockResolvedValue({ fields: fieldsFixture })

const lead = (id: number, firstName: string, status: EmailVerificationStatus) =>
  leadFixture(id, firstName, status)

const renderList = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <LeadsList />
    </QueryClientProvider>
  )
}

const rowOf = async (name: string) => (await screen.findByText(new RegExp(`^${name} Test$`))).closest('tr')!

describe('LeadsList email verification', () => {
  beforeEach(() => {
    getMany.mockReset()
    verifyEmails.mockReset()
  })

  it.each([
    ['UNVERIFIED', 'Not verified'],
    ['PENDING', 'Verifying'],
    ['VERIFIED', 'Verified'],
    ['INVALID', 'Invalid'],
    ['FAILED', "Couldn't verify"],
  ] as const)('shows %s as "%s"', async (status, label) => {
    getMany.mockResolvedValue([lead(1, 'Ada', status)])
    renderList()

    expect(within(await rowOf('Ada')).getByText(label)).toBeInTheDocument()
  })

  it('shows a progress indicator while verification runs', async () => {
    getMany.mockResolvedValue([lead(1, 'Ada', 'PENDING')])
    renderList()

    expect(within(await rowOf('Ada')).getByRole('status', { name: 'Verifying' })).toBeInTheDocument()
  })

  it('starts verification for the selected leads, closes the menu, and confirms it started', async () => {
    getMany.mockResolvedValue([
      lead(1, 'Ada', 'UNVERIFIED'),
      lead(2, 'Alan', 'UNVERIFIED'),
      lead(3, 'Grace', 'UNVERIFIED'),
    ])
    verifyEmails.mockResolvedValue({ started: [1, 2], failed: [] })
    renderList()

    await userEvent.click(within(await rowOf('Ada')).getByRole('checkbox'))
    await userEvent.click(within(await rowOf('Alan')).getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Enrich' }))
    await userEvent.click(screen.getByRole('button', { name: 'Verify Email' }))

    expect(verifyEmails).toHaveBeenCalledWith({ leadIds: [1, 2] })
    expect(screen.queryByRole('button', { name: 'Verify Email' })).not.toBeInTheDocument()
    expect(await screen.findByText('Verification started for 2 leads')).toBeInTheDocument()
  })

  it('reports leads whose verification could not start', async () => {
    getMany.mockResolvedValue([lead(1, 'Ada', 'UNVERIFIED')])
    verifyEmails.mockResolvedValue({ started: [], failed: [{ leadId: 1, error: 'Temporal unavailable' }] })
    renderList()

    await userEvent.click(within(await rowOf('Ada')).getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Enrich' }))
    await userEvent.click(screen.getByRole('button', { name: 'Verify Email' }))

    expect(await screen.findByText('Could not start verification for 1 lead')).toBeInTheDocument()
  })

  it('retries a failed verification from its row', async () => {
    getMany.mockResolvedValue([lead(7, 'Ada', 'FAILED')])
    verifyEmails.mockResolvedValue({ started: [7], failed: [] })
    renderList()

    await userEvent.click(within(await rowOf('Ada')).getByRole('button', { name: 'Retry verification' }))

    expect(verifyEmails).toHaveBeenCalledWith({ leadIds: [7] })
  })

  it('refreshes outcomes without a reload while a verification is pending', async () => {
    getMany.mockResolvedValueOnce([lead(1, 'Ada', 'PENDING')]).mockResolvedValue([lead(1, 'Ada', 'VERIFIED')])
    renderList()

    expect(within(await rowOf('Ada')).getByText('Verifying')).toBeInTheDocument()
    await waitFor(
      () =>
        expect(within(screen.getByText('Ada Test').closest('tr')!).getByText('Verified')).toBeInTheDocument(),
      {
        timeout: 4_000,
      }
    )
  }, 10_000)
})

describe('pollIntervalFor', () => {
  it('polls every two seconds while any lead is pending', () => {
    expect(pollIntervalFor([lead(1, 'Ada', 'VERIFIED'), lead(2, 'Alan', 'PENDING')])).toBe(2_000)
  })

  it('stops polling when nothing is pending', () => {
    expect(pollIntervalFor([lead(1, 'Ada', 'VERIFIED'), lead(2, 'Alan', 'FAILED')])).toBe(false)
    expect(pollIntervalFor(undefined)).toBe(false)
  })
})
