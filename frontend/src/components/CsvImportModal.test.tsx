import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { LeadsImportPreviewOutput, PlannedLead } from '../api/types/leads/importPreview'
import { CsvImportModal } from './CsvImportModal'

vi.mock('../api', () => ({
  api: { leads: { importPreview: vi.fn(), bulkImport: vi.fn() } },
}))

const importPreview = vi.mocked(api.leads.importPreview)
const bulkImport = vi.mocked(api.leads.bulkImport)

const header = 'firstName,lastName,email,jobTitle,companyName,yearsInRole,phoneNumber,countryCode'
const csv = (rows: string[]) => new File([[header, ...rows].join('\n')], 'leads.csv', { type: 'text/csv' })

const plannedLead = (overrides: Partial<PlannedLead> = {}): PlannedLead => ({
  status: 'new',
  email: 'ada@acme.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '555-0100-123',
  linkedinUrl: null,
  countryCode: 'ES',
  jobTitle: 'Eng. Manager',
  companyName: 'Acme',
  yearsInRole: 2,
  yearsAtCompany: 5,
  roles: [
    { rowNumber: 1, jobTitle: 'Engineer', companyName: 'Acme', yearsInRole: 3, isCurrent: false },
    { rowNumber: 2, jobTitle: 'Eng. Manager', companyName: 'Acme', yearsInRole: 2, isCurrent: true },
  ],
  rowNumbers: [1, 2],
  notes: [{ rowNumber: 1, field: 'countryCode', message: 'Converted from ESP' }],
  ...overrides,
})

const plan = (overrides: Partial<LeadsImportPreviewOutput> = {}): LeadsImportPreviewOutput => ({
  totalRows: 2,
  leads: [plannedLead()],
  invalidRows: [],
  ...overrides,
})

const renderModal = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <CsvImportModal isOpen onClose={() => {}} />
    </QueryClientProvider>
  )
}

const upload = async (file: File) => {
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]')!
  await userEvent.upload(input, file)
}

const rowFor = async (text: string) => (await screen.findByText(text)).closest('tr')!

describe('CsvImportModal', () => {
  beforeEach(() => {
    importPreview.mockReset()
    bulkImport.mockReset()
  })

  it('sends the raw rows with their original headers to the preview', async () => {
    importPreview.mockResolvedValue(plan())
    renderModal()

    await upload(csv(['Ada,Lovelace,ada@acme.com,Engineer,Acme,3,555-0100-123,ESP']))

    expect(importPreview).toHaveBeenCalledWith({
      rows: [
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@acme.com',
          jobTitle: 'Engineer',
          companyName: 'Acme',
          yearsInRole: '3',
          phoneNumber: '555-0100-123',
          countryCode: 'ESP',
        },
      ],
    })
  })

  it('shows each person once with phone, roles, years at company, and notes', async () => {
    importPreview.mockResolvedValue(plan())
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@acme.com,Engineer,Acme,3,555-0100-123,ESP']))

    const row = await rowFor('Ada Lovelace')
    expect(within(row).getByText('Ready')).toBeInTheDocument()
    expect(within(row).getByText('555-0100-123')).toBeInTheDocument()
    expect(within(row).getByText('2 roles')).toBeInTheDocument()
    expect(within(row).getByText('Current: Eng. Manager')).toBeInTheDocument()
    expect(within(row).getByText('5')).toBeInTheDocument()
    expect(within(row).getByText('Row 1: Converted from ESP')).toBeInTheDocument()
  })

  it('lists invalid rows with their reasons and leaves them out of the import', async () => {
    importPreview.mockResolvedValue(
      plan({
        totalRows: 3,
        invalidRows: [
          { rowNumber: 3, errors: ['Email is required'], firstName: 'No', lastName: 'Email', email: '' },
        ],
      })
    )
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@acme.com,,,,,']))

    const row = await rowFor('No Email')
    expect(within(row).getByText('Invalid')).toBeInTheDocument()
    expect(within(row).getByText('Row 3: Email is required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 Lead' })).toBeEnabled()
  })

  it('marks people who already exist and leaves them out of the import', async () => {
    importPreview.mockResolvedValue(
      plan({
        leads: [
          plannedLead(),
          plannedLead({
            status: 'duplicate',
            email: 'alan@example.com',
            firstName: 'Alan',
            lastName: 'Turing',
          }),
        ],
      })
    )
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@acme.com,,,,,']))

    expect(within(await rowFor('Alan Turing')).getByText('Already exists')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 Lead' })).toBeEnabled()
  })

  it('disables the import when the preview cannot be computed', async () => {
    importPreview.mockRejectedValue(new Error('network down'))
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@acme.com,,,,,']))

    expect(await screen.findByText('Could not check this file. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Import/ })).toBeDisabled()
  })

  it('imports the same raw rows and reports the result', async () => {
    importPreview.mockResolvedValue(plan())
    bulkImport.mockResolvedValue({
      success: true,
      importedCount: 1,
      duplicatesSkipped: 0,
      invalidRows: 0,
      errors: [],
    })
    renderModal()
    await upload(csv(['Ada,Lovelace,ada@acme.com,Engineer,Acme,3,555-0100-123,ESP']))

    await userEvent.click(await screen.findByRole('button', { name: 'Import 1 Lead' }))

    expect(bulkImport).toHaveBeenCalledWith({ rows: importPreview.mock.calls[0][0].rows })
    expect(await screen.findByText('Successfully imported 1 lead')).toBeInTheDocument()
  })

  it('describes the accepted columns and formats before a file is chosen', () => {
    renderModal()

    expect(
      screen.getByText(
        /Optional: jobTitle, companyName, countryCode, phoneNumber, linkedinUrl, yearsInRole, isCurrentRole/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Country accepts ISO codes such as ES, ESP, or 724, or an English name/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Rows with the same email become one person with several roles/)
    ).toBeInTheDocument()
  })
})
