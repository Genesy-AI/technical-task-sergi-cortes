import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import {
  StartVerification,
  temporalVerificationStarter,
  verificationWorkflowId,
} from './emailVerification/start'
import { createTestDb } from './test/testDb'
import { createActivities } from './workflows/activities'

const db = createTestDb()
beforeEach(() => db.reset())
afterAll(() => db.close())

const createLead = (email: string, emailVerificationStatus: 'UNVERIFIED' | 'FAILED' = 'UNVERIFIED') =>
  db.prisma.lead.create({ data: { firstName: 'Test', lastName: 'Lead', email, emailVerificationStatus } })

const statusOf = async (id: number) =>
  (await db.prisma.lead.findUniqueOrThrow({ where: { id } })).emailVerificationStatus

describe('POST /leads/verify-emails with a stubbed starter', () => {
  const started: number[] = []
  const recordingStarter: StartVerification = async (lead) => {
    started.push(lead.id)
  }
  const app = createApp(db.prisma, { startEmailVerification: recordingStarter })

  beforeEach(() => {
    started.length = 0
  })

  it('responds 202 with the started ids and marks those leads PENDING', async () => {
    const a = await createLead('a@example.com')
    const b = await createLead('b@example.com')

    const res = await request(app)
      .post('/leads/verify-emails')
      .send({ leadIds: [a.id, b.id] })

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ started: [a.id, b.id], failed: [] })
    expect(started).toEqual([a.id, b.id])
    expect(await statusOf(a.id)).toBe('PENDING')
    expect(await statusOf(b.id)).toBe('PENDING')
  })

  it('ignores ids that match no lead when others match', async () => {
    const a = await createLead('a@example.com')

    const res = await request(app)
      .post('/leads/verify-emails')
      .send({ leadIds: [a.id, 999_999] })

    expect(res.status).toBe(202)
    expect(res.body.started).toEqual([a.id])
  })

  it('responds 404 and changes nothing when no id matches a lead', async () => {
    const a = await createLead('a@example.com')

    const res = await request(app)
      .post('/leads/verify-emails')
      .send({ leadIds: [999_999] })

    expect(res.status).toBe(404)
    expect(started).toEqual([])
    expect(await statusOf(a.id)).toBe('UNVERIFIED')
  })

  it.each([
    ['a missing body', undefined],
    ['a missing leadIds field', {}],
    ['an empty list', { leadIds: [] }],
    ['a non-integer id', { leadIds: ['1'] }],
    ['a negative id', { leadIds: [-1] }],
    ['more than 500 ids', { leadIds: Array.from({ length: 501 }, (_, i) => i + 1) }],
  ])('responds 400 for %s', async (_label, body) => {
    const res = await request(app)
      .post('/leads/verify-emails')
      .send(body as object)

    expect(res.status).toBe(400)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it('marks a lead FAILED and reports it when its verification cannot start', async () => {
    const ok = await createLead('ok@example.com')
    const broken = await createLead('broken@example.com')
    const failingApp = createApp(db.prisma, {
      startEmailVerification: async (lead) => {
        if (lead.id === broken.id) throw new Error('Temporal unavailable')
      },
    })

    const res = await request(failingApp)
      .post('/leads/verify-emails')
      .send({ leadIds: [ok.id, broken.id] })

    expect(res.status).toBe(202)
    expect(res.body).toEqual({
      started: [ok.id],
      failed: [{ leadId: broken.id, error: 'Temporal unavailable' }],
    })
    expect(await statusOf(ok.id)).toBe('PENDING')
    expect(await statusOf(broken.id)).toBe('FAILED')
  })
})

describe('POST /leads/verify-emails against a Temporal test server', () => {
  let env: TestWorkflowEnvironment
  let worker: Worker
  let workerRun: Promise<void>
  const taskQueue = 'verify-emails-api-test'

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    env = await TestWorkflowEnvironment.createTimeSkipping()
    worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, 'workflows/workflows.ts'),
      activities: createActivities(db.prisma),
    })
    workerRun = worker.run()
  }, 120_000)

  afterAll(async () => {
    worker?.shutdown()
    await workerRun
    await env?.teardown()
  })

  const app = () =>
    createApp(db.prisma, {
      startEmailVerification: temporalVerificationStarter(async () => env.client, taskQueue),
    })
  const handleFor = (leadId: number) => env.client.workflow.getHandle(verificationWorkflowId(leadId))

  it('starts no second verification while one is running for the lead', async () => {
    const lead = await createLead('jane.smith@example.com')

    await request(app())
      .post('/leads/verify-emails')
      .send({ leadIds: [lead.id] })
    const first = await handleFor(lead.id).describe()
    const res = await request(app())
      .post('/leads/verify-emails')
      .send({ leadIds: [lead.id] })
    const second = await handleFor(lead.id).describe()

    expect(res.status).toBe(202)
    expect(second.runId).toBe(first.runId)
    expect(await statusOf(lead.id)).toBe('PENDING')
    await handleFor(lead.id).terminate('test finished')
  }, 60_000)

  it('starts a new verification once the previous one has ended', async () => {
    const lead = await createLead('ada@example.com', 'FAILED')

    await request(app())
      .post('/leads/verify-emails')
      .send({ leadIds: [lead.id] })
    const first = await handleFor(lead.id).describe()
    await handleFor(lead.id).result()
    expect(await statusOf(lead.id)).toBe('VERIFIED')

    await request(app())
      .post('/leads/verify-emails')
      .send({ leadIds: [lead.id] })
    const second = await handleFor(lead.id).describe()

    expect(second.runId).not.toBe(first.runId)
    await handleFor(lead.id).result()
  }, 60_000)
})
