import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createTestDb } from './test/testDb'

const db = createTestDb()
const app = createApp(db.prisma)

beforeEach(() => db.reset())
afterAll(() => db.close())

describe('GET /leads', () => {
  it('returns an empty list for an empty database', async () => {
    const res = await request(app).get('/leads')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns stored leads', async () => {
    await db.prisma.lead.create({ data: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' } })

    const res = await request(app).get('/leads')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })
  })
})
