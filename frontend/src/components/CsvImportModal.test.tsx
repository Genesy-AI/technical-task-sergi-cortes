import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { CsvImportModal } from './CsvImportModal'

vi.mock('../api', () => ({
  api: { leads: { normalizeCountryCodes: vi.fn(), bulkImport: vi.fn() } },
}))

const normalizeCountryCodes = vi.mocked(api.leads.normalizeCountryCodes)

const csv = (rows: string[]) =>
  new File([['firstName,lastName,email,countryCode', ...rows].join('\n')], 'leads.csv', { type: 'text/csv' })

const renderModal = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CsvImportModal isOpen onClose={() => {}} />
    </QueryClientProvider>
  )
}

const upload = async (file: File) => {
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]')!
  await userEvent.upload(input, file)
  await screen.findByText('Import Summary')
}

const rowFor = (name: string) => screen.getByText(name).closest('tr')!

describe('CsvImportModal country preview', () => {
  beforeEach(() => {
    normalizeCountryCodes.mockReset()
    normalizeCountryCodes.mockImplementation(async ({ values }) => ({
      results: values.map((value) =>
        value === 'ESP'
          ? { value, code: 'ES', outcome: 'converted' as const }
          : value === 'XXX'
            ? { value, code: null, outcome: 'cleared' as const }
            : { value, code: value, outcome: 'kept' as const }
      ),
    }))
  })

  it('shows the converted code and notes the original value', async () => {
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@example.com,ESP']))

    const row = rowFor('Ada Lovelace')
    expect(await within(row).findByText('ES')).toBeInTheDocument()
    expect(within(row).getByText('Converted from ESP')).toBeInTheDocument()
  })

  it('shows a cleared value as blank, notes it, and keeps the row valid', async () => {
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@example.com,XXX']))

    const row = rowFor('Ada Lovelace')
    expect(await within(row).findByText('XXX not recognized, left blank')).toBeInTheDocument()
    expect(within(row).getByText('Valid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 Valid Leads' })).toBeEnabled()
  })

  it('shows a kept code without a note', async () => {
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@example.com,FR']))

    const row = rowFor('Ada Lovelace')
    expect(await within(row).findByText('FR')).toBeInTheDocument()
    expect(within(row).queryByText(/Converted|not recognized/)).not.toBeInTheDocument()
  })

  it('requests each distinct non-empty country once', async () => {
    renderModal()
    await upload(
      csv([
        'Ada,Lovelace,ada@example.com,ESP',
        'Alan,Turing,alan@example.com,ESP',
        'Grace,Hopper,grace@example.com,',
      ])
    )

    await within(rowFor('Ada Lovelace')).findByText('ES')
    expect(normalizeCountryCodes).toHaveBeenCalledTimes(1)
    expect(normalizeCountryCodes).toHaveBeenCalledWith({ values: ['ESP'] })
  })

  it('falls back to the raw value with a note when the check fails', async () => {
    normalizeCountryCodes.mockRejectedValue(new Error('network down'))
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@example.com,ESP']))

    const row = rowFor('Ada Lovelace')
    expect(await within(row).findByText('Could not check this country')).toBeInTheDocument()
    expect(within(row).getByText('ESP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 Valid Leads' })).toBeEnabled()
  })

  it('describes the accepted country formats before a file is chosen', () => {
    renderModal()

    expect(
      screen.getByText(/Country accepts ISO codes such as ES, ESP, or 724, or an English name/)
    ).toBeInTheDocument()
  })
})
