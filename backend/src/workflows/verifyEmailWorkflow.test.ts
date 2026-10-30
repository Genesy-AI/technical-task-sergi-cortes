import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../test/testDb'
import { Activities, createActivities } from './activities'
import { verifyEmailWorkflow } from './workflows'

const db = createTestDb()
let env: TestWorkflowEnvironment

beforeAll(async () => {
  Runtime.install({ logger: new DefaultLogger('WARN') })
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
  await db.close()
})

beforeEach(() => db.reset())

const createPendingLead = (email: string) =>
  db.prisma.lead.create({
    data: { firstName: 'Test', lastName: 'Lead', email, emailVerificationStatus: 'PENDING' },
  })

const storedStatus = async (leadId: number) =>
  (await db.prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).emailVerificationStatus

/**
 * Runs one verification workflow on its own task queue.
 * Awaiting the result lets the test server skip time, and `workflowSeconds` is the duration in workflow time.
 */
const verify = async (
  lead: { id: number; email: string },
  activities: Activities = createActivities(db.prisma)
) => {
  const taskQueue = `test-${Math.random().toString(36).slice(2)}`
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: path.join(__dirname, 'workflows.ts'),
    activities,
  })

  return worker.runUntil(async () => {
    const handle = await env.client.workflow.start(verifyEmailWorkflow, {
      taskQueue,
      workflowId: `test-${taskQueue}`,
      args: [lead.id, lead.email],
    })
    const outcome = await handle.result()
    const { startTime, closeTime } = await handle.describe()
    return { outcome, workflowSeconds: (closeTime!.getTime() - startTime.getTime()) / 1000 }
  })
}

describe('verifyEmailWorkflow', () => {
  it.each([
    ['ada@example.com', 'VERIFIED'],
    ['john.doe@example.com', 'INVALID'],
    ['ada+news@example.com', 'INVALID'],
  ])(
    'records %s as %s',
    async (email, expected) => {
      const lead = await createPendingLead(email)

      expect((await verify(lead)).outcome).toBe(expected)
      expect(await storedStatus(lead.id)).toBe(expected)
    },
    60_000
  )

  it('records FAILED within 30 seconds when the check never completes in time', async () => {
    const lead = await createPendingLead('jane.smith@example.com')

    const { outcome, workflowSeconds } = await verify(lead)

    expect(outcome).toBe('FAILED')
    expect(await storedStatus(lead.id)).toBe('FAILED')
    expect(workflowSeconds).toBeLessThanOrEqual(30)
  }, 60_000)

  it('makes three attempts and stops each one when it times out', async () => {
    const real = createActivities(db.prisma)
    let started = 0
    let running = 0
    const instrumented: Activities = {
      ...real,
      verifyEmail: async (email) => {
        started++
        running++
        try {
          return await real.verifyEmail(email)
        } finally {
          running--
        }
      },
    }
    const lead = await createPendingLead('jane.smith@example.com')

    expect((await verify(lead, instrumented)).outcome).toBe('FAILED')

    const deadline = Date.now() + 8_000
    while (running > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    expect(started).toBe(3)
    expect(running).toBe(0)
  }, 60_000)
})
