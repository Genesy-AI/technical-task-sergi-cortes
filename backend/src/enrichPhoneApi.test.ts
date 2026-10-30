import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime } from '@temporalio/worker'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { StartPhoneEnrichment, temporalPhoneEnrichmentStarter } from './phoneEnrichment/start'
import { createTestDb } from './test/testDb'
import { phoneEnrichmentWorkflowId } from './workflows/phone/enrichPhoneWorkflow'

const db = createTestDb()
beforeEach(() => db.reset())
afterAll(() => db.close())

const createLead = (email: string, data: Record<string, unknown> = {}) =>
  db.prisma.lead.create({ data: { firstName: 'Test', lastName: 'Lead', email, ...data } })
const statusOf = async (id: number) =>
  (await db.prisma.lead.findUniqueOrThrow({ where: { id } })).phoneEnrichmentStatus

describe('POST /leads/enrich-phone with a stubbed starter', () => {
  const started: number[] = []
  const recordingStarter: StartPhoneEnrichment = async (leadId) => {
    started.push(leadId)
  }
  const app = createApp(db.prisma, {
    startEmailVerification: async () => {},
    startPhoneEnrichment: recordingStarter,
  })
  const enrich = (body: object) => request(app).post('/leads/enrich-phone').send(body)

  beforeEach(() => {
    started.length = 0
  })

  it('responds 202 with the started leads and marks them PENDING', async () => {
    const a = await createLead('a@example.com')
    const b = await createLead('b@example.com')

    const res = await enrich({ leadIds: [a.id, b.id] })

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ started: [a.id, b.id], skipped: [], failed: [] })
    expect(started).toEqual([a.id, b.id])
    expect(await statusOf(a.id)).toBe('PENDING')
  })

  it('skips leads that already have a phone and lists them with the reason', async () => {
    const withPhone = await createLead('a@example.com', { phone: '555-0100-123', phoneSource: 'IMPORT' })
    const without = await createLead('b@example.com')

    const res = await enrich({ leadIds: [withPhone.id, without.id] })

    expect(res.body).toEqual({
      started: [without.id],
      skipped: [{ leadId: withPhone.id, reason: 'HAS_PHONE' }],
      failed: [],
    })
    expect(started).toEqual([without.id])
    expect(await statusOf(withPhone.id)).toBe('NOT_STARTED')
  })

  it('re-enriches a lead with a phone when force is true', async () => {
    const withPhone = await createLead('a@example.com', { phone: '555-0100-123', phoneSource: 'IMPORT' })

    const res = await enrich({ leadIds: [withPhone.id], force: true })

    expect(res.body).toEqual({ started: [withPhone.id], skipped: [], failed: [] })
    expect(await statusOf(withPhone.id)).toBe('PENDING')
  })

  it('responds 404 and changes nothing when no id matches a lead', async () => {
    const res = await enrich({ leadIds: [999_999] })

    expect(res.status).toBe(404)
    expect(started).toEqual([])
  })

  it('responds 202 with everything skipped when every lead already has a phone', async () => {
    const withPhone = await createLead('a@example.com', { phone: '555-0100-123' })

    const res = await enrich({ leadIds: [withPhone.id] })

    expect(res.status).toBe(202)
    expect(res.body).toEqual({
      started: [],
      skipped: [{ leadId: withPhone.id, reason: 'HAS_PHONE' }],
      failed: [],
    })
  })

  it.each([
    ['a missing leadIds field', {}],
    ['an empty list', { leadIds: [] }],
    ['a non-integer id', { leadIds: ['1'] }],
    ['a negative id', { leadIds: [-1] }],
    ['more than 500 ids', { leadIds: Array.from({ length: 501 }, (_, i) => i + 1) }],
    ['a non-boolean force', { leadIds: [1], force: 'yes' }],
  ])('responds 400 for %s', async (_label, body) => {
    const res = await enrich(body)

    expect(res.status).toBe(400)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it('marks a lead FAILED and reports it when its lookup cannot start', async () => {
    const ok = await createLead('ok@example.com')
    const broken = await createLead('broken@example.com')
    const failingApp = createApp(db.prisma, {
      startEmailVerification: async () => {},
      startPhoneEnrichment: async (leadId) => {
        if (leadId === broken.id) throw new Error('Temporal unavailable')
      },
    })

    const res = await request(failingApp)
      .post('/leads/enrich-phone')
      .send({ leadIds: [ok.id, broken.id] })

    expect(res.body).toEqual({
      started: [ok.id],
      skipped: [],
      failed: [{ leadId: broken.id, error: 'Temporal unavailable' }],
    })
    expect(await statusOf(broken.id)).toBe('FAILED')
  })

  it('lists enrichment fields on GET /leads', async () => {
    await createLead('a@example.com')

    const [lead] = (await request(app).get('/leads')).body

    expect(lead).toMatchObject({
      phoneEnrichmentStatus: 'NOT_STARTED',
      phoneSource: null,
      phoneEnrichmentProgress: null,
      phoneEnrichmentAttempts: null,
      phoneEnrichedAt: null,
    })
  })
})

describe('POST /leads/enrich-phone against a Temporal test server', () => {
  let env: TestWorkflowEnvironment

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    env = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)
  afterAll(async () => {
    await env?.teardown()
  })

  // No worker polls the queue, so a started lookup stays running until the test ends it.
  const app = () =>
    createApp(db.prisma, {
      startEmailVerification: async () => {},
      startPhoneEnrichment: temporalPhoneEnrichmentStarter(async () => env.client),
    })
  const handleFor = (leadId: number) => env.client.workflow.getHandle(phoneEnrichmentWorkflowId(leadId))

  it('starts no second lookup while one is running for the lead', async () => {
    const lead = await createLead('a@example.com')

    await request(app())
      .post('/leads/enrich-phone')
      .send({ leadIds: [lead.id] })
    const first = await handleFor(lead.id).describe()
    await request(app())
      .post('/leads/enrich-phone')
      .send({ leadIds: [lead.id] })
    const second = await handleFor(lead.id).describe()

    expect(second.runId).toBe(first.runId)
    await handleFor(lead.id).terminate('test finished')
  }, 60_000)

  it('starts a new lookup once the previous one has ended', async () => {
    const lead = await createLead('b@example.com')

    await request(app())
      .post('/leads/enrich-phone')
      .send({ leadIds: [lead.id] })
    const first = await handleFor(lead.id).describe()
    await handleFor(lead.id).terminate('first lookup ended')
    await request(app())
      .post('/leads/enrich-phone')
      .send({ leadIds: [lead.id] })
    const second = await handleFor(lead.id).describe()

    expect(second.runId).not.toBe(first.runId)
    await handleFor(lead.id).terminate('test finished')
  }, 60_000)
})
