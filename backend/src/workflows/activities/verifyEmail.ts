import { Context } from '@temporalio/activity'

/** How long the mock takes for addresses it treats as slow, so timeouts can be exercised. */
const SLOW_CHECK_MS = 20_000
const HEARTBEAT_EVERY_MS = 1_000

/**
 * Waits like a slow provider call, heartbeating so the worker learns when the attempt has timed out.
 * `Context.sleep` throws a CancelledFailure once a heartbeat reports the attempt cancelled, which ends it.
 */
async function waitLikeSlowProvider(): Promise<void> {
  const context = Context.current()
  for (let waited = 0; waited < SLOW_CHECK_MS; waited += HEARTBEAT_EVERY_MS) {
    context.heartbeat()
    await context.sleep(HEARTBEAT_EVERY_MS)
  }
}

/**
 * Mock email check: `john.doe` and plus-addresses are rejected, `jane.smith` is slow, everything else passes.
 * A real provider call would pass `Context.current().cancellationSignal` to its HTTP client instead of waiting.
 */
export async function verifyEmail(email: string): Promise<boolean> {
  if (email.includes('john.doe')) {
    return false
  }

  if (email.includes('jane.smith')) {
    await waitLikeSlowProvider()
  }

  if (/\+/.test(email)) {
    return false
  }

  return true
}
