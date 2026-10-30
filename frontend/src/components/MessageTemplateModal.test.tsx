import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { fieldsFixture, leadFixture } from '../test/fixtures'
import { MessageTemplateModal } from './MessageTemplateModal'

vi.mock('../api', () => ({
  api: { leads: { generateMessages: vi.fn() } },
}))

const generateMessages = vi.mocked(api.leads.generateMessages)

const withPhone = leadFixture(1, 'Ada', 'UNVERIFIED', { phone: '555-0100-123', companyName: 'Acme' })
const withoutPhone = leadFixture(2, 'Alan', 'UNVERIFIED', { companyName: 'Acme' })

const renderModal = (selectedLeads = [withPhone, withoutPhone]) => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <MessageTemplateModal isOpen onClose={() => {}} selectedLeads={selectedLeads} fields={fieldsFixture} />
    </QueryClientProvider>
  )
}

const textarea = () => screen.getByLabelText('Message Template') as HTMLTextAreaElement
const picker = () => screen.getByRole('group', { name: 'Insert a field' })
const setTemplate = (value: string) => fireEvent.change(textarea(), { target: { value } })

describe('MessageTemplateModal field picker', () => {
  beforeEach(() => generateMessages.mockReset())

  it('lists templatable fields under their groups', () => {
    renderModal()

    for (const group of ['Person', 'Contact', 'Company', 'Role']) {
      expect(within(picker()).getByRole('heading', { name: group })).toBeInTheDocument()
    }
    expect(within(picker()).getByRole('button', { name: /Phone/ })).toBeInTheDocument()
    expect(within(picker()).getByRole('button', { name: /Years at company/ })).toBeInTheDocument()
  })

  it('does not offer fields that cannot be used in templates', () => {
    renderModal()

    expect(within(picker()).queryByRole('button', { name: /Message/ })).not.toBeInTheDocument()
    expect(within(picker()).queryByRole('button', { name: /Created/ })).not.toBeInTheDocument()
  })

  it('filters fields by label or key', async () => {
    renderModal()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search fields' }), 'link')

    const buttons = within(picker()).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([expect.stringContaining('LinkedIn')])
  })

  it('shows a message when no field matches the search', async () => {
    renderModal()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search fields' }), 'zzz')

    expect(within(picker()).getByText('No field matches "zzz"')).toBeInTheDocument()
  })

  it('inserts the chosen field at the cursor', async () => {
    renderModal()
    await userEvent.type(textarea(), 'Hi !')
    textarea().setSelectionRange(3, 3)

    await userEvent.click(within(picker()).getByRole('button', { name: /First name/ }))

    expect(textarea().value).toBe('Hi {firstName}!')
    expect(textarea().selectionStart).toBe('Hi {firstName}'.length)
  })
})

describe('MessageTemplateModal warnings', () => {
  beforeEach(() => generateMessages.mockReset())

  it('warns how many selected leads lack each used field', () => {
    renderModal()

    setTemplate('Call {phone} at {companyName}')

    expect(
      screen.getByText('Phone is missing in 1 of 2 selected leads, which will not get a message.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Company is missing/)).not.toBeInTheDocument()
  })

  it('marks unknown fields', () => {
    renderModal()

    setTemplate('Hi {unknownField}')

    expect(screen.getByText('{unknownField} is not a known field.')).toBeInTheDocument()
  })

  it('shows no warning when every selected lead has every used field', () => {
    renderModal()

    setTemplate('Hi {firstName} from {companyName}')

    expect(screen.queryByRole('status', { name: 'Template warnings' })).not.toBeInTheDocument()
  })

  it('generates for the selected leads and lists those that got no message', async () => {
    generateMessages.mockResolvedValue({
      success: true,
      generatedCount: 1,
      errors: [{ leadId: 2, leadName: 'Alan Test', error: 'Missing required field: phone' }],
    })
    renderModal()
    setTemplate('Call {phone}')

    await userEvent.click(screen.getByRole('button', { name: 'Generate Messages' }))

    expect(generateMessages).toHaveBeenCalledWith({ leadIds: [1, 2], template: 'Call {phone}' })
    expect(await screen.findByText('Alan Test')).toBeInTheDocument()
  })
})
