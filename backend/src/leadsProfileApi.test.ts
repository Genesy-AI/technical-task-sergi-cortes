import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma, { startEmailVerification: async () => {} })
beforeEach(() => db.reset())
afterAll(() => db.close())

const person = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@acme.com' }
const importRows = (rows: Record<string, string>[]) => request(app).post('/leads/bulk').send({ rows })
const listLeads = async () => (await request(app).get('/leads')).body

describe('GET /leads profile fields', () => {
  it('returns phone, LinkedIn URL, roles in order, the current role, and summed years at company', async () => {
    await importRows([
      {
        ...person,
        companyName: 'Globex',
        jobTitle: 'Analyst',
        yearsInRole: '4',
        phoneNumber: '555-0100-123',
      },
      {
        ...person,
        companyName: 'Acme',
        jobTitle: 'Engineer',
        yearsInRole: '3',
        linkedinUrl: 'linkedin.com/in/ada',
      },
      { ...person, companyName: 'Acme', jobTitle: 'Eng. Manager', yearsInRole: '2' },
    ])

    const [lead] = await listLeads()

    expect(lead).toMatchObject({
      phone: '555-0100-123',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      jobTitle: 'Eng. Manager',
      companyName: 'Acme',
      yearsInRole: 2,
      yearsAtCompany: 5,
    })
    expect(lead.roles).toEqual([
      { position: 0, jobTitle: 'Analyst', companyName: 'Globex', yearsInRole: 4, isCurrent: false },
      { position: 1, jobTitle: 'Engineer', companyName: 'Acme', yearsInRole: 3, isCurrent: false },
      { position: 2, jobTitle: 'Eng. Manager', companyName: 'Acme', yearsInRole: 2, isCurrent: true },
    ])
  })

  it('reports blank years when no role at the current company has years', async () => {
    await importRows([{ ...person, companyName: 'Acme', jobTitle: 'Engineer' }])

    const [lead] = await listLeads()

    expect(lead).toMatchObject({ yearsInRole: null, yearsAtCompany: null })
  })

  it('handles leads created without roles', async () => {
    await db.prisma.lead.create({ data: { ...person, jobTitle: 'Engineer' } })

    const [lead] = await listLeads()

    expect(lead).toMatchObject({
      roles: [],
      yearsInRole: null,
      yearsAtCompany: null,
      phone: null,
      linkedinUrl: null,
    })
  })
})
