import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma)

afterAll(() => db.close())

const normalize = (body: unknown) =>
  request(app)
    .post('/leads/country-codes/normalize')
    .send(body as object)

describe('POST /leads/country-codes/normalize', () => {
  it('returns one result per value, in request order', async () => {
    const res = await normalize({ values: ['ES', 'esp', '12', 'XXX', 'Spain', ''] })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      results: [
        { value: 'ES', code: 'ES', outcome: 'kept' },
        { value: 'esp', code: 'ES', outcome: 'converted' },
        { value: '12', code: 'DZ', outcome: 'converted' },
        { value: 'XXX', code: null, outcome: 'cleared' },
        { value: 'Spain', code: 'ES', outcome: 'converted' },
        { value: '', code: null, outcome: 'empty' },
      ],
    })
  })

  it('accepts an empty list', async () => {
    const res = await normalize({ values: [] })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ results: [] })
  })

  it.each([
    ['a missing values field', {}],
    ['a non-array values field', { values: 'ES' }],
    ['a non-string entry', { values: ['ES', 12] }],
    ['a null entry', { values: [null] }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await normalize(body)

    expect(res.status).toBe(400)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it('rejects more than 1000 values', async () => {
    const res = await normalize({ values: Array.from({ length: 1001 }, () => 'ES') })

    expect(res.status).toBe(400)
  })

  it('rejects a value longer than 100 characters', async () => {
    const res = await normalize({ values: ['x'.repeat(101)] })

    expect(res.status).toBe(400)
  })

  it('does not write to the database', async () => {
    await normalize({ values: ['ES'] })

    expect(await db.prisma.lead.count()).toBe(0)
  })
})
