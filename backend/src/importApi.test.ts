import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma, { startEmailVerification: async () => {} })
beforeEach(() => db.reset())
afterAll(() => db.close())

const adaRows = [
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@acme.com',
    jobTitle: 'Engineer',
    companyName: 'Acme',
    yearsInRole: '3',
    phoneNumber: '555-0100-123',
  },
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@acme.com',
    jobTitle: 'Eng. Manager',
    companyName: 'Acme',
    yearsInRole: '2',
  },
]

const storedLeads = () =>
  db.prisma.lead.findMany({ include: { roles: { orderBy: { position: 'asc' } } }, orderBy: { id: 'asc' } })

describe('POST /leads/import/preview', () => {
  it('returns the grouped leads, roles, and notes without writing anything', async () => {
    const res = await request(app).post('/leads/import/preview').send({ rows: adaRows })

    expect(res.status).toBe(200)
    expect(res.body.totalRows).toBe(2)
    expect(res.body.leads).toHaveLength(1)
    expect(res.body.leads[0]).toMatchObject({
      status: 'new',
      email: 'ada@acme.com',
      phone: '555-0100-123',
      jobTitle: 'Eng. Manager',
      yearsAtCompany: 5,
    })
    expect(res.body.leads[0].roles).toHaveLength(2)
    expect(await db.prisma.lead.count()).toBe(0)
  })

  it('marks people whose email already exists as duplicates, ignoring case', async () => {
    await db.prisma.lead.create({ data: { firstName: 'Ada', lastName: 'L', email: 'ADA@acme.com' } })

    const res = await request(app).post('/leads/import/preview').send({ rows: adaRows })

    expect(res.body.leads[0].status).toBe('duplicate')
  })

  it.each([
    ['a missing rows field', {}],
    ['a non-array rows field', { rows: 'x' }],
    ['a non-object row', { rows: ['x'] }],
    ['more than 5000 rows', { rows: Array.from({ length: 5001 }, () => ({})) }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/leads/import/preview').send(body)

    expect(res.status).toBe(400)
    expect(res.body.error).toEqual(expect.any(String))
  })
})

describe('POST /leads/bulk', () => {
  it('marks an imported phone as coming from the import, and starts enrichment as not started', async () => {
    await request(app)
      .post('/leads/bulk')
      .send({ rows: [...adaRows, { firstName: 'No', lastName: 'Phone', email: 'no.phone@acme.com' }] })

    const [ada, noPhone] = await storedLeads()
    expect(ada).toMatchObject({ phoneSource: 'IMPORT', phoneEnrichmentStatus: 'NOT_STARTED' })
    expect(noPhone).toMatchObject({ phoneSource: null, phoneEnrichmentStatus: 'NOT_STARTED' })
  })

  it('stores each person once with their roles in file order', async () => {
    const res = await request(app).post('/leads/bulk').send({ rows: adaRows })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, importedCount: 1, duplicatesSkipped: 0, invalidRows: 0 })
    const [lead] = await storedLeads()
    expect(lead).toMatchObject({
      email: 'ada@acme.com',
      phone: '555-0100-123',
      jobTitle: 'Eng. Manager',
      companyName: 'Acme',
    })
    expect(lead.roles.map((r) => [r.position, r.jobTitle, r.yearsInRole, r.isCurrent])).toEqual([
      [0, 'Engineer', 3, false],
      [1, 'Eng. Manager', 2, true],
    ])
  })

  it('skips a person whose email already exists, ignoring case', async () => {
    await db.prisma.lead.create({ data: { firstName: 'Ada', lastName: 'L', email: 'ADA@acme.com' } })

    const res = await request(app).post('/leads/bulk').send({ rows: adaRows })

    expect(res.body).toMatchObject({ importedCount: 0, duplicatesSkipped: 1 })
    expect(await db.prisma.lead.count()).toBe(1)
  })

  it('imports a new email even when the name already exists', async () => {
    await db.prisma.lead.create({ data: { firstName: 'Ada', lastName: 'Lovelace', email: 'old@acme.com' } })

    const res = await request(app).post('/leads/bulk').send({ rows: adaRows })

    expect(res.body.importedCount).toBe(1)
    expect(await db.prisma.lead.count()).toBe(2)
  })

  it('counts invalid rows and imports the rest', async () => {
    const res = await request(app)
      .post('/leads/bulk')
      .send({ rows: [...adaRows, { firstName: 'No', lastName: 'Email', email: '' }] })

    expect(res.body).toMatchObject({ importedCount: 1, invalidRows: 1 })
  })

  it('responds 400 when there is nothing valid to import', async () => {
    const res = await request(app)
      .post('/leads/bulk')
      .send({ rows: [{ firstName: 'No', email: '' }] })

    expect(res.status).toBe(400)
  })

  it('stores exactly what the preview showed', async () => {
    const rows = [
      ...adaRows,
      {
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.com',
        countryCode: 'ESP',
        linkedinUrl: 'linkedin.com/in/alan/',
      },
    ]
    const preview = (await request(app).post('/leads/import/preview').send({ rows })).body

    await request(app).post('/leads/bulk').send({ rows })

    const stored = await storedLeads()
    expect(stored).toHaveLength(preview.leads.length)
    for (const planned of preview.leads) {
      const lead = stored.find((l) => l.email === planned.email)!
      expect(lead).toMatchObject({
        firstName: planned.firstName,
        lastName: planned.lastName,
        phone: planned.phone,
        linkedinUrl: planned.linkedinUrl,
        countryCode: planned.countryCode,
        jobTitle: planned.jobTitle,
        companyName: planned.companyName,
      })
      expect(lead.roles.map((r) => [r.jobTitle, r.companyName, r.yearsInRole, r.isCurrent])).toEqual(
        planned.roles.map(
          (r: { jobTitle: string; companyName: string; yearsInRole: number; isCurrent: boolean }) => [
            r.jobTitle,
            r.companyName,
            r.yearsInRole,
            r.isCurrent,
          ]
        )
      )
    }
  })
})
