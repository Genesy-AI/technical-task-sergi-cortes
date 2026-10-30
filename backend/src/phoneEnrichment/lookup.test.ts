import { ApplicationFailure } from '@temporalio/common'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderId } from './catalog'
import type { ProviderSettings } from './config'
import { lookupPhone, LookupOptions } from './lookup'
import { PROVIDERS } from './providers'
import type { EnrichableLead } from './providers/types'

const lead: EnrichableLead = {
  firstName: 'Pamela',
  lastName: 'Walker',
  email: 'pamela26@walker.com',
  jobTitle: 'CTO',
  countryCode: null,
}

const settings = (id: ProviderId): ProviderSettings => ({
  id,
  apiKey: `${id.toLowerCase()}-secret`,
  baseUrl: `https://providers.test/${id.toLowerCase()}`,
})

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })

const stubFetch = (response: Response | (() => Promise<Response>)) =>
  vi.fn<typeof fetch>(typeof response === 'function' ? response : async () => response)

const lookup = (id: ProviderId, fetchStub: typeof fetch, options: Partial<LookupOptions> = {}, who = lead) =>
  lookupPhone(PROVIDERS[id], settings(id), who, { fetch: fetchStub, ...options })

/** Runs a lookup that must fail and returns its ApplicationFailure. */
const failureOf = async (promise: Promise<unknown>): Promise<ApplicationFailure> => {
  const error = await promise.then(
    () => {
      throw new Error('expected the lookup to fail')
    },
    (e: unknown) => e
  )
  expect(error).toBeInstanceOf(ApplicationFailure)
  return error as ApplicationFailure
}

describe('provider inputs', () => {
  it('asks Astra Dialer by email, authenticating with the apiKey header', async () => {
    const fetchStub = stubFetch(json({}))

    await lookup('ASTRA', fetchStub)

    const [url, init] = fetchStub.mock.calls[0]
    expect(url).toBe('https://providers.test/astra')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ apiKey: 'astra-secret', 'content-type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'pamela26@walker.com' })
  })

  it('asks Nimbus Lookup by email and job title, authenticating with the api query parameter', async () => {
    const fetchStub = stubFetch(json({}))

    await lookup('NIMBUS', fetchStub)

    const [url, init] = fetchStub.mock.calls[0]
    expect(url).toBe('https://providers.test/nimbus?api=nimbus-secret')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'pamela26@walker.com', jobTitle: 'CTO' })
  })

  it('asks Orion Connect by full name and company website, authenticating with the x-auth-me header', async () => {
    const fetchStub = stubFetch(json({ phone: null }))

    await lookup('ORION', fetchStub)

    const [url, init] = fetchStub.mock.calls[0]
    expect(url).toBe('https://providers.test/orion')
    expect(init?.headers).toMatchObject({ 'x-auth-me': 'orion-secret' })
    expect(JSON.parse(String(init?.body))).toEqual({
      fullName: 'Pamela Walker',
      companyWebsite: 'walker.com',
    })
  })

  it('passes the abort signal to fetch', async () => {
    const fetchStub = stubFetch(json({}))
    const controller = new AbortController()

    await lookup('ASTRA', fetchStub, { signal: controller.signal })

    const signal = fetchStub.mock.calls[0][1]?.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    controller.abort()
    expect(signal?.aborted).toBe(true)
  })
})

describe('skip reasons', () => {
  it('never skips Astra Dialer', () => {
    expect(PROVIDERS.ASTRA.inputFrom({ ...lead, jobTitle: null })).toEqual({
      input: { email: 'pamela26@walker.com' },
    })
  })

  it.each([null, '', '   '])('skips Nimbus Lookup without a job title (%j)', (jobTitle) => {
    expect(PROVIDERS.NIMBUS.inputFrom({ ...lead, jobTitle })).toEqual({ skip: 'Missing job title' })
  })

  it('skips Orion Connect for a free email address', () => {
    expect(PROVIDERS.ORION.inputFrom({ ...lead, email: 'ada@gmail.com' })).toEqual({
      skip: 'No business domain',
    })
  })

  it('does not call a provider whose inputs are missing', async () => {
    const fetchStub = stubFetch(json({}))

    const failure = await failureOf(lookup('NIMBUS', fetchStub, {}, { ...lead, jobTitle: null }))

    expect(failure.nonRetryable).toBe(true)
    expect(failure.type).toBe('ProviderInputMissing')
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('response normalizing', () => {
  it.each([
    ['ASTRA', { phoneNmbr: '+14056304797' }, '+14056304797'],
    ['NIMBUS', { phoneNmbr: 612345678, countryCode: 'ES' }, '+34612345678'],
    ['NIMBUS', { number: 612345678, countryCode: 'ES' }, '+34612345678'],
    ['ORION', { phone: '+34 612 34 56 78' }, '+34612345678'],
  ] as const)('reads a phone from %s %j', async (id, body, phone) => {
    expect(await lookup(id, stubFetch(json(body)))).toMatchObject({ found: true, phone })
  })

  it('keeps the raw value for diagnosis', async () => {
    expect(await lookup('NIMBUS', stubFetch(json({ phoneNmbr: 612345678, countryCode: 'ES' })))).toEqual({
      found: true,
      phone: '+34612345678',
      rawPhone: '612345678',
    })
  })

  it("formats with the lead's country when the provider gives none", async () => {
    const result = await lookupPhone(
      PROVIDERS.ASTRA,
      settings('ASTRA'),
      { ...lead, countryCode: 'US' },
      { fetch: stubFetch(json({ phoneNmbr: '4056304797' })) }
    )

    expect(result).toMatchObject({ found: true, phone: '+14056304797' })
  })

  it('keeps a number it cannot format as returned', async () => {
    expect(await lookup('ASTRA', stubFetch(json({ phoneNmbr: '4056304797' })))).toMatchObject({
      phone: '4056304797',
    })
  })

  it.each([
    ['ASTRA', {}],
    ['ASTRA', { phoneNmbr: null }],
    ['ASTRA', { phoneNmbr: '  ' }],
    ['NIMBUS', { countryCode: 'ES' }],
    ['NIMBUS', { number: null }],
    ['ORION', { phone: null }],
    ['ORION', {}],
  ] as const)('finds nothing in %s %j', async (id, body) => {
    expect(await lookup(id, stubFetch(json(body)))).toEqual({ found: false })
  })

  it.each([
    ['ASTRA', 'not json'],
    ['ASTRA', '[]'],
    ['ORION', '{"phone":{"value":"1"}}'],
  ] as const)('treats %s answering %j as a retryable bad response', async (id, body) => {
    const failure = await failureOf(lookup(id, stubFetch(new Response(body, { status: 200 }))))

    expect(failure.type).toBe('ProviderBadResponse')
    expect(failure.nonRetryable).toBe(false)
  })
})

describe('error mapping', () => {
  it.each([400, 401, 403])('does not retry a %i answer', async (status) => {
    const failure = await failureOf(
      lookup('ASTRA', stubFetch(json({ message: 'Missing required input' }, { status })))
    )

    expect(failure.type).toBe('ProviderRequestRejected')
    expect(failure.nonRetryable).toBe(true)
    expect(failure.message).toContain(String(status))
  })

  it('never puts the key in an error message', async () => {
    const failure = await failureOf(
      lookup('NIMBUS', stubFetch(new Response('<html>401</html>', { status: 401 })))
    )

    expect(failure.message).not.toContain('nimbus-secret')
  })

  it.each([500, 502, 503, 404])('retries a %i answer', async (status) => {
    const failure = await failureOf(lookup('ORION', stubFetch(new Response('oops', { status }))))

    expect(failure.type).toBe('ProviderUnavailable')
    expect(failure.nonRetryable).toBe(false)
  })

  it('retries a network error', async () => {
    const failure = await failureOf(
      lookup(
        'ORION',
        stubFetch(async () => {
          throw new TypeError('fetch failed')
        })
      )
    )

    expect(failure.type).toBe('ProviderUnavailable')
    expect(failure.nonRetryable).toBe(false)
  })

  it('retries a 429 no sooner than its Retry-After seconds', async () => {
    const failure = await failureOf(
      lookup('ASTRA', stubFetch(new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } })))
    )

    expect(failure.type).toBe('ProviderRateLimited')
    expect(failure.nonRetryable).toBe(false)
    expect(failure.nextRetryDelay).toBe(5_000)
  })

  it('reads a Retry-After date', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T10:00:00Z') })
    try {
      const failure = await failureOf(
        lookup(
          'ASTRA',
          stubFetch(
            new Response('', { status: 429, headers: { 'Retry-After': 'Fri, 30 Oct 2026 10:00:07 GMT' } })
          )
        )
      )

      expect(failure.nextRetryDelay).toBe(7_000)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([null, 'soon', '-3'])(
    'falls back to the retry policy for a 429 with Retry-After %j',
    async (value) => {
      const headers: Record<string, string> = value === null ? {} : { 'Retry-After': value }
      const failure = await failureOf(lookup('ASTRA', stubFetch(new Response('', { status: 429, headers }))))

      expect(failure.type).toBe('ProviderRateLimited')
      expect(failure.nextRetryDelay).toBeUndefined()
    }
  )

  it('aborts the request and retries when the attempt takes too long', async () => {
    let requestSignal: AbortSignal | undefined
    const hanging = stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          requestSignal = hanging.mock.calls[0][1]?.signal ?? undefined
          requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason))
        })
    )

    const failure = await failureOf(lookup('ORION', hanging, { timeoutMs: 20 }))

    expect(failure.type).toBe('ProviderTimeout')
    expect(failure.nonRetryable).toBe(false)
    expect(requestSignal?.aborted).toBe(true)
  })

  it('lets a cancellation through unchanged', async () => {
    const controller = new AbortController()
    const cancelled = new Error('cancelled by Temporal')
    const hanging = stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          hanging.mock.calls[0][1]?.signal?.addEventListener('abort', () => reject(cancelled))
        })
    )

    const pending = lookup('ORION', hanging, { signal: controller.signal })
    controller.abort(cancelled)

    await expect(pending).rejects.toBe(cancelled)
  })
})
