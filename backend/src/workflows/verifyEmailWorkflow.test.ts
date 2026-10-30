import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as activities from './activities'
import { verifyEmailWorkflow } from './workflows'

let env: TestWorkflowEnvironment

beforeAll(async () => {
  Runtime.install({ logger: new DefaultLogger('WARN') })
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
})

const runWorkflow = async (email: string) => {
  const taskQueue = `test-${Math.random().toString(36).slice(2)}`
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: path.join(__dirname, 'workflows.ts'),
    activities,
  })
  return worker.runUntil(
    env.client.workflow.execute(verifyEmailWorkflow, {
      taskQueue,
      workflowId: `test-${taskQueue}`,
      args: [email],
    })
  )
}

describe('verifyEmailWorkflow', () => {
  it('verifies an ordinary email', async () => {
    expect(await runWorkflow('ada@example.com')).toBe(true)
  }, 60_000)

  // Documents FIX-002: today the slow check retries forever. Flip to `it` when the fix lands.
  it.fails(
    'reaches an outcome within 30 seconds for a check that never completes in time',
    async () => {
      const taskQueue = `test-${Math.random().toString(36).slice(2)}`
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: path.join(__dirname, 'workflows.ts'),
        activities,
      })
      const realStart = Date.now()

      const outcome = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start(verifyEmailWorkflow, {
          taskQueue,
          workflowId: `test-${taskQueue}`,
          args: ['jane.smith@example.com'],
        })
        const result = await Promise.race([
          handle.result().then(() => 'finished' as const),
          env.sleep('30 seconds').then(() => 'still running' as const),
        ])
        if (result === 'still running') await handle.terminate('test bound reached')
        return result
      })

      expect(outcome).toBe('finished')
      // Time skipping makes the 30 seconds of workflow time nearly instant.
      expect(Date.now() - realStart).toBeLessThan(10_000)
    },
    120_000
  )
})
