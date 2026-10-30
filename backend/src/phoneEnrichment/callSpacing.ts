/** Waits until this caller may make its call; rejects with the signal's reason if it aborts first. */
export type CallSpacer = (signal?: AbortSignal) => Promise<void>

/**
 * Lets calls through at most once per `minIntervalMs`, in the order they asked.
 * Each caller reserves its slot synchronously, so concurrent attempts in this process never share a slot.
 * An aborted caller keeps its slot, which only ever spaces later calls further apart.
 */
export function createCallSpacer(minIntervalMs: number): CallSpacer {
  let nextSlot = 0

  return (signal) => {
    if (signal?.aborted) return Promise.reject(signal.reason)

    const now = Date.now()
    const slot = Math.max(now, nextSlot)
    nextSlot = slot + minIntervalMs
    const delay = slot - now
    if (delay === 0) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer)
        reject(signal?.reason)
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, delay)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}
