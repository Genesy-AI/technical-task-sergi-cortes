# 0006 - One Temporal task queue per phone provider

- **Status:** Accepted, extends [0002](0002-start-then-observe-background-work.md)
- **Date:** 2026-10-30
- **Related change:** [enrich-lead-phone](../../openspec/changes/enrich-lead-phone/design.md)

## Decision

`enrichPhoneWorkflow` runs on the `phone-enrichment` task queue, and each provider's lookup activity runs on its own queue: `phone-astra`, `phone-nimbus`, and `phone-orion`.
The backend process starts one worker per queue, and an optional `PHONE_<PROVIDER>_MAX_PER_SECOND` sets that worker's `maxTaskQueueActivitiesPerSecond`.
Each lookup has its own attempt time limit (5, 8, and 10 seconds) and three attempts, so a slow provider cannot hold up the others' limits.
A rate-limited provider's worker also sets `maxActivitiesPerSecond` to the same value, polls one task at a time, and spaces its calls by the interval with `createCallSpacer` before each request.

## Why

Provider rate limits apply per provider across every caller, and `maxTaskQueueActivitiesPerSecond` is enforced by the Temporal server for all workers polling a queue.
A limit on a shared queue would throttle every provider to the slowest one, and a limit per worker process would multiply with each process started.
The server limit holds the average rate but releases short bursts, one per task queue partition and open poll: at 1 per second, three Orion calls went out within 15 ms ([evidence](../features/enrich-lead-phone.md#orion-rate-limit-task-82)).
The worker settings keep waiting tasks in Temporal rather than in the worker, and the spacing removes the remaining jitter, so one process sends its calls exactly one interval apart.

## Alternatives considered

- Worker `maxActivitiesPerSecond` on one shared queue was rejected, because it limits each worker process, not each provider.
- A token bucket stored in the database was rejected, because Temporal already provides server-side task queue limits.
- Spacing calls in the worker without the poll settings was rejected, because tasks the server releases in a burst would wait inside their attempt time limit instead of in Temporal.

## Consequences

Each provider adds a worker and a task queue to operate.
Changing a provider's limit means restarting the workers with the new variable, and the last started worker's value wins on the server.
Exact spacing holds within one process; several processes polling the same queue are held to the limit on average, with bursts no larger than one call per process.
