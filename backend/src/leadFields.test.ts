import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma, { startEmailVerification: async () => {} })
afterAll(() => db.close())

describe('GET /leads/fields', () => {
  it('describes every lead field with its label, group, type, template use, and column default', async () => {
    const res = await request(app).get('/leads/fields')

    expect(res.status).toBe(200)
    const byKey = Object.fromEntries(res.body.fields.map((f: { key: string }) => [f.key, f]))

    expect(byKey.phone).toEqual({
      key: 'phone',
      label: 'Phone',
      group: 'Contact',
      type: 'phone',
      templatable: true,
      column: 'visible',
    })
    expect(byKey.linkedinUrl).toMatchObject({ label: 'LinkedIn', type: 'url', column: 'available' })
    expect(byKey.yearsInRole).toMatchObject({ group: 'Role', type: 'number', templatable: true })
    expect(byKey.yearsAtCompany).toMatchObject({ templatable: true, column: 'available' })
    expect(byKey.message).toMatchObject({ templatable: false, column: 'visible' })
  })

  it('lists the default visible columns from the leads-table spec', async () => {
    const res = await request(app).get('/leads/fields')

    const visible = res.body.fields
      .filter((f: { column: string }) => f.column === 'visible')
      .map((f: { key: string }) => f.key)
    const available = res.body.fields
      .filter((f: { column: string }) => f.column === 'available')
      .map((f: { key: string }) => f.key)
    expect(visible).toEqual(['email', 'phone', 'countryCode', 'jobTitle', 'companyName', 'message'])
    expect(available).toEqual(['linkedinUrl', 'yearsInRole', 'yearsAtCompany', 'createdAt'])
  })

  it('does not expose internal normalization functions', async () => {
    const res = await request(app).get('/leads/fields')

    for (const field of res.body.fields) {
      expect(Object.keys(field).sort()).toEqual(['column', 'group', 'key', 'label', 'templatable', 'type'])
    }
  })
})
