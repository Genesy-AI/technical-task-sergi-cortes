import { Context } from '@temporalio/activity'
import { ApplicationFailure } from '@temporalio/common'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker, WorkerOptions } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { LookupActivities } from '../../phoneEnrichment/activities'
import {
  PHONE_ENRICHMENT_TASK_QUEUE,
  PROVIDER_CATALOG,
  ProviderId,
  worstCaseLookupMs,
} from '../../phoneEnrichment/catalog'
import { loadPhoneEnrichmentConfig, PhoneEnrichmentConfig } from '../../phoneEnrichment/config'
import type { EnrichableLead } from '../../phoneEnrichment/providers/types'
import type { EnrichPhoneResult } from '../../phoneEnrichment/types'
import { phoneEnrichmentWorkerOptions, runPhoneEnrichmentWorkers } from '../../phoneEnrichment/workers'
import { InMemoryPhoneEnrichmentStore } from '../../test/inMemoryPhoneEnrichmentStore'
import { enrichPhoneWorkflow, phoneEnrichmentWorkflowId } from './enrichPhoneWorkflow'

let env: TestWorkflowEnvironment

beforeAll(async () => {
  // ERROR, not WARN: these tests fail activities on purpose, and each failure would otherwise log a stack trace.
  Runtime.install({ logger: new DefaultLogger('ERROR') })
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
})

const config: PhoneEnrichmentConfig = loadPhoneEnrichmentConfig({
  ASTRA_API_KEY: 'astra-key',
  NIMBUS_API_KEY: 'nimbus-key',
  ORION_API_KEY: 'orion-key',
  ASTRA_BASE_URL: 'https://providers.test/astra',
  NIMBUS_BASE_URL: 'https://providers.test/nimbus',
  ORION_BASE_URL: 'https://providers.test/orion',
})

const businessLead: EnrichableLead = {
  firstName: 'Pamela',
  lastName: 'Walker',
  email: 'pamela26@walker.com',
  jobTitle: 'CTO',
  countryCode: null,
}

type Lookup = LookupActivities['lookupPhone']

const found =
  (phone: string): Lookup =>
  async () => ({ found: true, phone, rawPhone: phone })
const notFound: Lookup = async () => ({ found: false })
const serverError: Lookup = async () => {
  throw ApplicationFailure.retryable('Provider answered with status 500', 'ProviderUnavailable')
}
const unauthorized: Lookup = async () => {
  throw ApplicationFailure.nonRetryable(
    'Provider rejected the request with status 401',
    'ProviderRequestRejected'
  )
}
const mustNotRun =
  (id: ProviderId): Lookup =>
  async () => {
    throw new Error(`${id} must not be called`)
  }

/** Never answers, like a provider that hangs, but ends when the attempt is cancelled or the worker stops. */
const hangs: Lookup = () =>
  new Promise((_, reject) => {
    const signal = Context.current().cancellationSignal
    signal.addEventListener('abort', () => reject(signal.reason))
  })

/**
 * Runs the given workers until one lookup ends, starting the workflow the way the start endpoint will.
 * Awaiting the result lets the test server skip time, and `workflowSeconds` is the duration in workflow time.
 */
async function runLookup(
  workerOptions: Omit<WorkerOptions, 'connection'>[],
  leadId: number,
  hooks: {
    /** Runs once the workflow has started, while the workers run. */
    onStarted?: (handle: Awaited<ReturnType<typeof env.client.workflow.start>>) => Promise<void>
    /** Runs after the workflow ended, before the workers stop and cancel what is still running. */
    afterResult?: () => Promise<void>
  } = {}
) {
  const workers = await Promise.all(
    workerOptions.map((options) =>
      Worker.create({ ...options, connection: env.nativeConnection, shutdownGraceTime: '1 second' })
    )
  )
  const runs = workers.map((worker) => worker.run())
  try {
    const handle = await env.client.workflow.start(enrichPhoneWorkflow, {
      taskQueue: PHONE_ENRICHMENT_TASK_QUEUE,
      workflowId: `${phoneEnrichmentWorkflowId(leadId)}-${Math.random().toString(36).slice(2)}`,
      args: [leadId],
    })
    await hooks.onStarted?.(handle)
    const result = (await handle.result()) as EnrichPhoneResult | null
    const { startTime, closeTime } = await handle.describe()
    await hooks.afterResult?.()
    return { result, workflowSeconds: (closeTime!.getTime() - startTime.getTime()) / 1000, handle }
  } finally {
    workers.forEach((worker) => worker.shutdown())
    await Promise.all(runs)
  }
}

/** Real persistence activities on an in-memory store, with each provider's lookup replaced by a mock. */
function mockedWorkers(store: InMemoryPhoneEnrichmentStore, lookups: Partial<Record<ProviderId, Lookup>>) {
  const [main, ...providers] = phoneEnrichmentWorkerOptions({ config, store })
  return [
    main,
    ...providers.map((options) => {
      const id = (Object.keys(PROVIDER_CATALOG) as ProviderId[]).find(
        (candidate) => PROVIDER_CATALOG[candidate].taskQueue === options.taskQueue
      )!
      return { ...options, activities: { lookupPhone: vi.fn(lookups[id] ?? mustNotRun(id)) } }
    }),
  ]
}

const lookupCalls = (workers: ReturnType<typeof mockedWorkers>, id: ProviderId) => {
  const options = workers.find((o) => o.taskQueue === PROVIDER_CATALOG[id].taskQueue)!
  return (options.activities as { lookupPhone: ReturnType<typeof vi.fn> }).lookupPhone.mock.calls.length
}

describe('enrichPhoneWorkflow', () => {
  it('stops at the first provider that finds a phone', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)
    const workers = mockedWorkers(store, { ASTRA: found('+14056304797') })

    const { result } = await runLookup(workers, leadId)

    expect(result).toEqual({
      status: 'FOUND',
      phone: '+14056304797',
      source: 'ASTRA',
      attempts: [{ provider: 'ASTRA', result: 'FOUND', phone: '+14056304797', rawPhone: '+14056304797' }],
    })
    expect(store.get(leadId)).toMatchObject({
      status: 'FOUND',
      phone: '+14056304797',
      source: 'ASTRA',
      step: null,
    })
    expect(store.get(leadId).enrichedAt).toBeInstanceOf(Date)
    expect(lookupCalls(workers, 'NIMBUS')).toBe(0)
    expect(lookupCalls(workers, 'ORION')).toBe(0)
  }, 60_000)

  it('records the source when a later provider finds the phone', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead, '555-0100')

    const { result } = await runLookup(
      mockedWorkers(store, { ASTRA: notFound, NIMBUS: notFound, ORION: found('+15550199') }),
      leadId
    )

    expect(result?.status).toBe('FOUND')
    expect(store.get(leadId)).toMatchObject({ status: 'FOUND', phone: '+15550199', source: 'ORION' })
    expect(store.get(leadId).attempts).toEqual([
      { provider: 'ASTRA', result: 'NOT_FOUND' },
      { provider: 'NIMBUS', result: 'NOT_FOUND' },
      { provider: 'ORION', result: 'FOUND', phone: '+15550199', rawPhone: '+15550199' },
    ])
  }, 60_000)

  it('skips providers whose inputs the lead lacks, without calling them, and ends NOT_FOUND', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add({ ...businessLead, email: 'ada@gmail.com', jobTitle: null })
    const workers = mockedWorkers(store, { ASTRA: notFound })

    const { result } = await runLookup(workers, leadId)

    expect(result).toEqual({
      status: 'NOT_FOUND',
      attempts: [
        { provider: 'ASTRA', result: 'NOT_FOUND' },
        { provider: 'NIMBUS', result: 'SKIPPED', reason: 'no job title' },
        { provider: 'ORION', result: 'SKIPPED', reason: 'no business domain' },
      ],
    })
    expect(store.get(leadId).status).toBe('NOT_FOUND')
    expect(lookupCalls(workers, 'NIMBUS')).toBe(0)
    expect(lookupCalls(workers, 'ORION')).toBe(0)
  }, 60_000)

  it('ends NOT_FOUND when every attempted provider answers without a phone', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add({ ...businessLead, email: 'ada@gmail.com' })

    const { result } = await runLookup(mockedWorkers(store, { ASTRA: notFound, NIMBUS: notFound }), leadId)

    expect(result?.status).toBe('NOT_FOUND')
    expect(store.get(leadId).status).toBe('NOT_FOUND')
  }, 60_000)

  it('ends FAILED when a provider keeps failing and none finds a phone, after trying the rest', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)
    const workers = mockedWorkers(store, { ASTRA: notFound, NIMBUS: serverError, ORION: notFound })

    const { result } = await runLookup(workers, leadId)

    expect(result?.status).toBe('FAILED')
    expect(result?.attempts).toEqual([
      { provider: 'ASTRA', result: 'NOT_FOUND' },
      { provider: 'NIMBUS', result: 'ERRORED', error: 'Provider answered with status 500' },
      { provider: 'ORION', result: 'NOT_FOUND' },
    ])
    expect(store.get(leadId).status).toBe('FAILED')
    expect(lookupCalls(workers, 'NIMBUS')).toBe(3)
    expect(lookupCalls(workers, 'ORION')).toBe(1)
  }, 60_000)

  it('does not retry a rejected request', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)
    const workers = mockedWorkers(store, { ASTRA: unauthorized, NIMBUS: notFound, ORION: notFound })

    const { result } = await runLookup(workers, leadId)

    expect(result?.status).toBe('FAILED')
    expect(lookupCalls(workers, 'ASTRA')).toBe(1)
  }, 60_000)

  it('still finds a phone after an earlier provider failed', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)

    const { result } = await runLookup(
      mockedWorkers(store, { ASTRA: serverError, NIMBUS: found('+34612345678') }),
      leadId
    )

    expect(result).toMatchObject({ status: 'FOUND', source: 'NIMBUS' })
  }, 60_000)

  it('records which provider is being tried and its position, before calling it', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add({ ...businessLead, jobTitle: null })
    const stepWhenCalled: Partial<Record<ProviderId, unknown>> = {}
    const recordingStep =
      (id: ProviderId): Lookup =>
      async () => {
        stepWhenCalled[id] = store.get(leadId).step
        return { found: false }
      }

    await runLookup(
      mockedWorkers(store, { ASTRA: recordingStep('ASTRA'), ORION: recordingStep('ORION') }),
      leadId
    )

    expect(store.get(leadId).progress).toEqual([
      { provider: 'ASTRA', position: 1, total: 3, attempts: [] },
      {
        provider: 'ORION',
        position: 3,
        total: 3,
        attempts: [
          { provider: 'ASTRA', result: 'NOT_FOUND' },
          { provider: 'NIMBUS', result: 'SKIPPED', reason: 'no job title' },
        ],
      },
    ])
    expect(stepWhenCalled).toEqual({ ASTRA: 'ASTRA', ORION: 'ORION' })
    expect(store.get(leadId).step).toBeNull()
  }, 60_000)

  it('ends without saving anything when the lead was deleted', async () => {
    const store = new InMemoryPhoneEnrichmentStore()

    const { result } = await runLookup(mockedWorkers(store, {}), 999)

    expect(result).toBeNull()
  }, 60_000)

  // The test server does not skip time while an activity runs, so hanging providers would take the full 78 s
  // of real time. The bound is checked from the same timeouts and retry policy the workflow uses, and the
  // timed-out attempt test below shows that a hanging provider is given up on after its three attempts.
  it('reaches an outcome within 90 seconds even when every provider times out on every attempt', () => {
    expect(worstCaseLookupMs()).toBe(78_000)
    expect(worstCaseLookupMs()).toBeLessThanOrEqual(90_000)
  })

  it('records FAILED when the lookup itself is cancelled, so the lead does not stay pending', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)

    await expect(
      runLookup(mockedWorkers(store, { ASTRA: hangs }), leadId, {
        onStarted: async (handle) => {
          await vi.waitFor(() => expect(store.get(leadId).step).toBe('ASTRA'), { timeout: 10_000 })
          await handle.cancel()
        },
      })
    ).rejects.toThrow()

    expect(store.get(leadId).status).toBe('FAILED')
    expect(store.get(leadId).step).toBeNull()
  }, 60_000)
})

describe('enrichPhoneWorkflow with real lookups against stubbed providers', () => {
  const eventTimeMs = (event: { eventTime?: { seconds?: unknown; nanos?: number | null } | null }) =>
    Number(event.eventTime?.seconds ?? 0) * 1000 + Math.floor((event.eventTime?.nanos ?? 0) / 1e6)

  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      ...init,
    })

  it('waits at least the Retry-After of a 429 before the next attempt', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add(businessLead)
    let calls = 0
    const fetchStub = vi.fn<typeof fetch>(async () =>
      ++calls === 1
        ? new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } })
        : json({ phoneNmbr: '+14056304797' })
    )

    const { result, handle } = await runLookup(
      phoneEnrichmentWorkerOptions({ config, store, fetch: fetchStub }),
      leadId
    )

    expect(result).toMatchObject({ status: 'FOUND', source: 'ASTRA', phone: '+14056304797' })
    expect(fetchStub).toHaveBeenCalledTimes(2)
    // The history keeps the lookup's scheduling and its last attempt's start, in workflow time.
    const { events } = await handle.fetchHistory()
    const lookupScheduled = events!.find(
      (e) => e.activityTaskScheduledEventAttributes?.taskQueue?.name === PROVIDER_CATALOG.ASTRA.taskQueue
    )!
    const lookupStarted = events!.find(
      (e) =>
        e.activityTaskStartedEventAttributes?.scheduledEventId?.toString() ===
        lookupScheduled.eventId?.toString()
    )!
    expect(lookupStarted.activityTaskStartedEventAttributes?.attempt).toBe(2)
    expect(eventTimeMs(lookupStarted) - eventTimeMs(lookupScheduled)).toBeGreaterThanOrEqual(5_000)
  }, 60_000)

  it('aborts the request of each timed-out attempt, then moves on to the next provider', async () => {
    const store = new InMemoryPhoneEnrichmentStore()
    const leadId = store.add({ ...businessLead, jobTitle: null })
    const abortReasons: string[] = []
    let started = 0
    let running = 0
    const hangingFetch = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('orion')) return json({ phone: '+34612345678' })
      started++
      running++
      return new Promise<Response>((_, reject) => {
        const signal = init!.signal!
        signal.addEventListener('abort', () => {
          running--
          abortReasons.push(signal.reason?.name)
          reject(signal.reason)
        })
      })
    })

    const { result } = await runLookup(
      phoneEnrichmentWorkerOptions({ config, store, fetch: hangingFetch }),
      leadId,
      {
        afterResult: () => vi.waitFor(() => expect(running).toBe(0), { timeout: 10_000, interval: 100 }),
      }
    )

    expect(result).toMatchObject({ status: 'FOUND', source: 'ORION' })
    expect(result?.attempts[0]).toMatchObject({ provider: 'ASTRA', result: 'ERRORED' })
    expect(started).toBe(3)
    expect(abortReasons).toEqual(['TimeoutError', 'TimeoutError', 'TimeoutError'])
  }, 60_000)
})

describe('phoneEnrichmentWorkerOptions', () => {
  const store = new InMemoryPhoneEnrichmentStore()

  it('runs the workflow on its own queue and each configured provider on its own queue', () => {
    const options = phoneEnrichmentWorkerOptions({ config, store })

    expect(options.map((o) => o.taskQueue)).toEqual([
      PHONE_ENRICHMENT_TASK_QUEUE,
      'phone-astra',
      'phone-nimbus',
      'phone-orion',
    ])
    expect(options[0].workflowsPath).toBeDefined()
    expect(options.slice(1).every((o) => o.workflowsPath === undefined)).toBe(true)
  })

  it('applies each configured rate limit to its provider queue only', () => {
    const limited = loadPhoneEnrichmentConfig({
      ASTRA_API_KEY: 'a',
      NIMBUS_API_KEY: 'n',
      ORION_API_KEY: 'o',
      PHONE_ORION_MAX_PER_SECOND: '1',
    })

    const options = phoneEnrichmentWorkerOptions({ config: limited, store })

    expect(options.map((o) => o.maxTaskQueueActivitiesPerSecond)).toEqual([
      undefined,
      undefined,
      undefined,
      1,
    ])
  })

  it('only starts workers for the providers in the order', () => {
    const astraOnly = loadPhoneEnrichmentConfig({ ASTRA_API_KEY: 'a', PHONE_PROVIDER_ORDER: 'ASTRA' })

    expect(phoneEnrichmentWorkerOptions({ config: astraOnly, store }).map((o) => o.taskQueue)).toEqual([
      PHONE_ENRICHMENT_TASK_QUEUE,
      'phone-astra',
    ])
  })
})

describe('runPhoneEnrichmentWorkers', () => {
  it('refuses to start, naming the variable, when a provider key is missing', async () => {
    const connect = vi.fn()

    await expect(
      runPhoneEnrichmentWorkers({
        store: new InMemoryPhoneEnrichmentStore(),
        env: { NIMBUS_API_KEY: 'n', ORION_API_KEY: 'o' },
        connect,
      })
    ).rejects.toThrow(/ASTRA_API_KEY is required/)
    expect(connect).not.toHaveBeenCalled()
  })
})
