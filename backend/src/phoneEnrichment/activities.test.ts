import { MockActivityEnvironment } from '@temporalio/testing'
import { describe, expect, it, vi } from 'vitest'
import { createLookupActivities } from './activities'
import { PROVIDERS } from './providers'
import type { EnrichableLead } from './providers/types'

const lead: EnrichableLead = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@analytical.example',
  jobTitle: 'Engineer',
  countryCode: 'GB',
}
const settings = { apiKey: 'key', baseUrl: 'https://astra.test' }
const found = () =>
  new Response(JSON.stringify({ phoneNmbr: '+442079460000' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('lookupPhone activity', () => {
  it('calls the provider only once the call spacing lets it through', async () => {
    let open!: () => void
    const spacing = vi.fn(() => new Promise<void>((resolve) => (open = resolve)))
    const fetchFn = vi.fn(async () => found())
    const { lookupPhone } = createLookupActivities(PROVIDERS.ASTRA, settings, fetchFn, spacing)
    const env = new MockActivityEnvironment({ startToCloseTimeoutMs: 5000 })

    const result = env.run(lookupPhone, lead)
    await vi.waitFor(() => expect(spacing).toHaveBeenCalledOnce())
    expect(fetchFn).not.toHaveBeenCalled()

    open()

    await expect(result).resolves.toMatchObject({ phone: '+442079460000' })
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('passes the attempt cancellation signal to the spacing', async () => {
    const spacing = vi.fn(async (_signal?: AbortSignal) => {})
    const { lookupPhone } = createLookupActivities(PROVIDERS.ASTRA, settings, async () => found(), spacing)
    const env = new MockActivityEnvironment({ startToCloseTimeoutMs: 5000 })

    await env.run(lookupPhone, lead)

    expect(spacing.mock.calls[0][0]).toBe(env.context.cancellationSignal)
  })

  it('times the request out with what is left of the attempt after waiting for its turn', async () => {
    const spacing = () => new Promise<void>((resolve) => setTimeout(resolve, 200))
    let calledAt = 0
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          calledAt = Date.now()
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    const { lookupPhone } = createLookupActivities(PROVIDERS.ASTRA, settings, fetchFn, spacing)
    const env = new MockActivityEnvironment({ startToCloseTimeoutMs: 300 })

    await expect(env.run(lookupPhone, lead)).rejects.toThrow()

    // Without the deduction the request would get the whole 300 ms after waiting 200 ms.
    expect(Date.now() - calledAt).toBeLessThan(200)
  })
})
