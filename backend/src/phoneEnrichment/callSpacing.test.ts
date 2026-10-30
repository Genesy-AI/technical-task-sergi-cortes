import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallSpacer } from './callSpacing'

describe('createCallSpacer', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }))
  afterEach(() => vi.useRealTimers())

  const releaseTimes = (waits: Promise<void>[]) => {
    const times: number[] = []
    waits.forEach((wait) => wait.then(() => times.push(Date.now())))
    return times
  }

  it('lets the first call through at once', async () => {
    const times = releaseTimes([createCallSpacer(1000)()])

    await vi.advanceTimersByTimeAsync(0)

    expect(times).toEqual([0])
  })

  it('spaces calls that arrive together by the interval, in arrival order', async () => {
    const space = createCallSpacer(1000)
    const times = releaseTimes([space(), space(), space()])

    await vi.advanceTimersByTimeAsync(2500)

    expect(times).toEqual([0, 1000, 2000])
  })

  it('does not delay a call that comes after a quiet interval', async () => {
    const space = createCallSpacer(1000)
    await space()
    await vi.advanceTimersByTimeAsync(5000)
    const times = releaseTimes([space()])

    await vi.advanceTimersByTimeAsync(0)

    expect(times).toEqual([5000])
  })

  it('only waits for the rest of the interval after a recent call', async () => {
    const space = createCallSpacer(1000)
    await space()
    await vi.advanceTimersByTimeAsync(400)
    const times = releaseTimes([space()])

    await vi.advanceTimersByTimeAsync(1000)

    expect(times).toEqual([1000])
  })

  it('stops waiting with the abort reason when the signal aborts', async () => {
    const space = createCallSpacer(1000)
    await space()
    const controller = new AbortController()
    const waiting = space(controller.signal)

    controller.abort(new Error('attempt cancelled'))

    await expect(waiting).rejects.toThrow('attempt cancelled')
  })

  it('rejects at once when the signal is already aborted', async () => {
    const space = createCallSpacer(1000)
    await space()

    await expect(space(AbortSignal.abort(new Error('gone')))).rejects.toThrow('gone')
  })
})
