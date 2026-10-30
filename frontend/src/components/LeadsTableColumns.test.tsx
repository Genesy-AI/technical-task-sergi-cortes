import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { fieldsFixture, leadFixture } from '../test/fixtures'
import { LeadsList } from './LeadsList'

vi.mock('../api', () => ({
  api: { leads: { getMany: vi.fn(), getFields: vi.fn(), verifyEmails: vi.fn(), deleteMany: vi.fn() } },
}))

const ada = leadFixture(1, 'Ada', 'UNVERIFIED', {
  phone: '+1-280-754-0462x2154',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  jobTitle: 'Eng. Manager',
  companyName: 'Acme',
  countryCode: 'GB',
  yearsInRole: 2,
  yearsAtCompany: 5,
})
const alan = leadFixture(2, 'Alan')

const renderList = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LeadsList />
    </QueryClientProvider>
  )
}

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())
const rowOf = async (name: string) => (await screen.findByText(`${name} Test`)).closest('tr')!

describe('leads table columns', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.leads.getMany).mockResolvedValue([ada, alan])
    vi.mocked(api.leads.getFields).mockResolvedValue({ fields: fieldsFixture })
  })
  afterEach(() => localStorage.clear())

  it('shows the default columns, with name always first', async () => {
    renderList()
    await rowOf('Ada')

    expect(headers()).toEqual(['', 'Name', 'Email', 'Phone', 'Country', 'Job title', 'Company', 'Message'])
  })

  it('shows a dash for blank values', async () => {
    renderList()

    const row = await rowOf('Alan')
    const phoneCell = within(row).getAllByRole('cell')[headers().indexOf('Phone')]
    expect(phoneCell).toHaveTextContent('-')
  })

  it('links a phone with tel:', async () => {
    renderList()

    const link = within(await rowOf('Ada')).getByRole('link', { name: '+1-280-754-0462x2154' })
    // Extensions use the RFC 3966 form so dialers understand them.
    expect(link).toHaveAttribute('href', 'tel:+1-280-754-0462;ext=2154')
  })

  it('shows hidden columns from the column menu, and links LinkedIn safely in a new tab', async () => {
    renderList()
    await rowOf('Ada')

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'LinkedIn' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Years at company' }))

    expect(headers()).toEqual(expect.arrayContaining(['LinkedIn', 'Years at company']))
    const row = await rowOf('Ada')
    const link = within(row).getByRole('link', { name: 'LinkedIn profile of Ada Test' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/ada')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(row).getByText('5')).toBeInTheDocument()
  })

  it('remembers hidden columns across reloads', async () => {
    const first = renderList()
    await rowOf('Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Message' }))
    first.unmount()

    renderList()
    await rowOf('Ada')

    expect(headers()).not.toContain('Message')
  })

  it('falls back to the defaults when stored columns cannot be read', async () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderList()
    await rowOf('Ada')

    expect(headers()).toContain('Phone')
    getItem.mockRestore()
  })
})
