# Design

## Context

See proposal.md for motivation and specs/email-verification/spec.md for the required behavior.

The current flow fails at two layers.

```
POST /leads/verify-emails [ids]
  for each lead, sequentially:
    client.workflow.execute(verifyEmailWorkflow, id verify-email-{id}-{Date.now()})
      activity verifyEmail: startToCloseTimeout 1s, no retry policy
        server default retry: unlimited attempts, backoff 1s x2 up to 100s
        jane.smith sleeps 20s --> times out on every attempt --> never ends
  respond --> never reached
```

- The activity has no `scheduleToCloseTimeout`, and the SDK default for it is unlimited.
- The mock activity cannot be cancelled, so every timed-out attempt keeps sleeping in the worker.
- The API opens a new Temporal connection per request, and the frontend axios client has no timeout.
- The frontend success toast reads only `verifiedCount` and ignores the returned errors.
- `emailVerified` is a nullable boolean, which cannot represent "in progress" or "could not verify".
- The Temporal worker runs in the API process, and `backend/src/index.ts` starts both on import.

Verified against the installed packages: Temporal SDK 1.13 supports `workflowIdConflictPolicy: 'USE_EXISTING'`, `workflowIdReusePolicy: 'ALLOW_DUPLICATE'`, and delivers a `CancelledFailure` with message `TIMED_OUT` to activities that listen for cancellation.
Prisma 6.15 accepts an `enum` on the SQLite provider.

## Goals / Non-Goals

**Goals:**

- A start-then-observe pattern for background lead work that the enrich-phone feature can reuse.
- Every verification ends in a recorded outcome in bounded time.

**Non-Goals:**

- Moving the Temporal worker into its own process.
- Server-sent events or websockets for live updates.
- Calling a real email verification provider.
- Rate limiting of verification requests.

## Decisions

### Decision 1: Start then observe

```
UI                      API                       Temporal                  DB
 |  POST verify [ids]    |                           |                       |
 |---------------------->|  set PENDING              |                       |
 |                       |------------------------------------------------->|
 |                       |  start verify-email-{id}  |                       |
 |                       |-------------------------->|                       |
 |  202 { started }      |                           |                       |
 |<----------------------|                           |                       |
 |                       |                           |  verifyEmail          |
 |  poll GET /leads      |                           |  saveVerificationResult
 |  while any PENDING    |                           |---------------------->|
```

The endpoint validates ids, sets the found leads to `PENDING`, starts one workflow per lead with `client.workflow.start`, and responds `202` with the started ids.
Workflows are started concurrently, not awaited for results.

Alternative considered: keep the request synchronous with bounded retries.
Rejected because a batch with several slow leads still blocks the request for a long time, and it gives no per-lead progress.

### Decision 2: The workflow records the outcome

The workflow calls `verifyEmail`, maps the result to `VERIFIED` or `INVALID`, and catches the final `ActivityFailure` to map it to `FAILED`.
It then calls a `saveVerificationResult` activity that writes the status with Prisma.

Alternative considered: the API polls Temporal for results and writes them.
Rejected because results would be lost when no client is polling, which breaks the requirement that outcomes do not depend on the client.

### Decision 3: Bounded retries, no workflow deadline

| Activity | startToCloseTimeout | heartbeatTimeout | Retry policy |
| --- | --- | --- | --- |
| `verifyEmail` | 5s | 2s | 3 attempts, initial 1s, coefficient 2 |
| `saveVerificationResult` | 5s | none | 10 attempts, initial 1s, coefficient 2, max 30s |

```
attempt 1 [=====x]  backoff 1s  attempt 2 [=====x]  backoff 2s  attempt 3 [=====x] --> FAILED
0s                                                                         about 18s
```

A slow check fails in about 18 seconds, inside the 30-second bound of the spec.
No workflow execution timeout is set, because a timed-out workflow runs no more code and would leave the lead `PENDING` forever.
If the worker is down, the workflow waits and resumes when the worker returns, which is the intended durable behavior.

Alternative considered: a 30-second time limit so that slow checks succeed.
Rejected by product decision: a 20-second check counts as a hang and must end as `FAILED`.

### Decision 4: One workflow per lead

The workflow id is `verify-email-{leadId}`, with `workflowIdConflictPolicy: 'USE_EXISTING'` and `workflowIdReusePolicy: 'ALLOW_DUPLICATE'`.
A start while a verification is running returns the existing handle, and a start after it closed creates a new run.

Alternative considered: keep the timestamp in the id and check `PENDING` in the database first.
Rejected because the database check races with concurrent requests, while Temporal enforces id uniqueness atomically.

### Decision 5: Cancellable activities

`verifyEmail` heartbeats every second while it waits, and waits with `Context.current().sleep()`.
When an attempt times out, the next heartbeat delivers a `TIMED_OUT` cancellation and the attempt stops.
A real provider call passes `Context.current().cancellationSignal` to its HTTP client for the same effect.

### Decision 6: Status as a Prisma enum with a data migration

A migration adds `emailVerificationStatus` as an enum with default `UNVERIFIED`, copies `true` to `VERIFIED`, `false` to `INVALID`, and `NULL` to `UNVERIFIED`, and then drops `emailVerified`.
The migration SQL is edited by hand after `prisma migrate dev --create-only` to include the data copy.

### Decision 7: One shared Temporal client

The API creates one Temporal client lazily on first use and reuses it, instead of connecting per request.
The worker keeps its own native connection.

### Decision 8: Polling in the frontend

The leads query uses a `refetchInterval` of two seconds while any lead is `PENDING`, and stops polling otherwise.
The email cell shows a spinner for `PENDING`, distinct icons and labels for `VERIFIED`, `INVALID`, and `FAILED`, and a retry button for `FAILED`.

Alternative considered: server-sent events.
Rejected for now because polling meets the five-second update requirement with no new infrastructure.

### Decision 9: Make the Express app importable for tests

`backend/src/index.ts` is split so an `app` module builds and exports the Express app, and the entry point only listens and starts the worker.
API tests use `supertest` with a test SQLite database, and workflow tests use `@temporalio/testing` with time skipping.
The `fix-csv-country-codes` change needs the same split, and whichever change lands first performs it.

## Risks / Trade-offs

- [The workflow fails to start after leads were set to `PENDING`] → The endpoint sets those leads to `FAILED` and reports them in the response.
- [Rows stay `PENDING` while the worker is down] → Accepted as durable behavior, and documented in the architecture notes.
- [The breaking API change affects other clients] → The only known client is this frontend, updated in the same change.
- [Polling load with many open tabs] → Polling runs only while a lead is `PENDING`, and pagination is a separate improvement.
- [Time-skipping tests behave differently from a real server] → An end-to-end check against `temporal server start-dev` confirms the bound.

## Migration Plan

1. Apply the Prisma migration, which maps existing values.
2. Deploy the backend and frontend together, because the API response and lead shape change.

Rollback: revert the code and restore the database from the pre-migration file, because the migration drops `emailVerified`.
