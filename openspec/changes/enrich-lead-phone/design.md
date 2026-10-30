# Design

## Context

See proposal.md for motivation and specs/phone-enrichment/spec.md for the required behavior.

Live probes of the three test endpoints on 2026-10-30, with synthetic inputs only, showed:

| Provider | Successful latency | Server errors | Response observed |
| --- | --- | --- | --- |
| Astra Dialer | 0.2 to 2.6 s | 2 of 7 calls returned 500 | `{"phoneNmbr":"4056304797"}` or `{}`, varying for the same email |
| Nimbus Lookup | 2.4 to 4.9 s | 1 of 5 | `{"phoneNmbr":2780696217,"countryCode":"ES"}`, not the `number` field the README documents |
| Orion Connect | about 4.2 s | 2 of 6, failing fast | `{"phone":"..."}`, never `null` in the probes |

All three answer 401 with an HTML body for a bad key and 400 `{"message":"Missing required input"}` for a missing field, and none sends rate-limit headers.
The endpoints are mocks with random results, so tests must stub HTTP.

The lead has `firstName`, `lastName`, `email`, and optional `jobTitle` and `countryCode`, and `add-lead-fields` adds `phone`.
There is no company website.
`fix-email-verification-stall` establishes the start-then-observe pattern: a 202 start endpoint, a per-lead status, a workflow id per lead with `USE_EXISTING` and `ALLOW_DUPLICATE`, bounded retries, a save activity, and UI polling while anything is pending.

## Goals / Non-Goals

**Goals:**

- Adding a fourth provider means one new provider module and one configuration entry.
- A slow or failing provider never blocks the lookup beyond its own bounded retries.

**Non-Goals:**

- Choosing between several found numbers or merging them.
- Bulk enrichment of every lead without a selection.
- Billing or cost tracking per provider call.
- Editing a phone by hand.

## Decisions

### Decision 1: A provider abstraction with skip, call, and normalize

```
PhoneProvider
  id: 'ASTRA' | 'NIMBUS' | 'ORION'
  label: 'Astra Dialer' | ...
  inputFrom(lead)          -> { input } | { skip: reason }
  call(input, signal)      -> raw JSON           (credentials from config)
  normalize(raw, lead)     -> { phone, country? } | { notFound: true }
```

| Provider | Input from the lead | Skip when |
| --- | --- | --- |
| Astra Dialer | `{ email }` | never |
| Nimbus Lookup | `{ email, jobTitle }` | no job title |
| Orion Connect | `{ fullName: first + last, companyWebsite: email domain }` | free email domain |

Nimbus's normalizer accepts both `phoneNmbr` and the documented `number`, and treats a missing value as not found.
Errors map to typed failures: 400, 401, and 403 are non-retryable, while 5xx, network errors, and timeouts are retryable.

### Decision 2: Business domain from email, using a maintained free-mail list

Orion's `companyWebsite` is the full domain after `@`, lowercased, unless it is in the `free-email-domains` package list, in which case Orion is skipped with the reason "no business domain".

Alternative considered: a hand-written list of free email domains.
Rejected because it would miss regional providers and need constant upkeep.

### Decision 3: One workflow per lead, providers as separate activities

```
enrichPhoneWorkflow(leadId)
  lead = loadLead(leadId)
  attempts = []
  for provider in config.order:
    if skip: attempts.push(skipped); continue
    recordProgress(leadId, provider, step)
    try   result = lookup[provider](lead)        <- own task queue, own timeouts
    catch attempts.push(errored); continue
    if found: savePhone(leadId, FOUND, phone, provider, attempts); return
    attempts.push(notFound)
  saveOutcome(leadId, anyErrored ? FAILED : NOT_FOUND, attempts)
```

| Activity | startToClose | Retry policy |
| --- | --- | --- |
| Astra lookup | 5 s | 3 attempts, initial 1 s, coefficient 2 |
| Nimbus lookup | 8 s | 3 attempts, initial 1 s, coefficient 2 |
| Orion lookup | 10 s | 3 attempts, initial 1 s, coefficient 2 |
| `loadLead`, `recordProgress`, `savePhone`, `saveOutcome` | 5 s | 10 attempts, initial 1 s, coefficient 2, max 30 s |

The worst case of three providers timing out on every attempt is about 78 seconds, inside the 90-second bound.
Unlike email verification, a provider's final failure does not end the workflow: it is recorded and the next provider runs.
Activities pass `Context.current().cancellationSignal` to `fetch`, so a timed-out attempt aborts its HTTP request.

The workflow id is `enrich-phone-{leadId}` with `USE_EXISTING` and `ALLOW_DUPLICATE`, so a second start returns the running lookup, and a finished lead can be looked up again.
It is independent of `verify-email-{leadId}`, and every save activity updates only enrichment columns, so both workflows can run on one lead.

### Decision 4: Rate limits through one task queue per provider

Each provider's activities run on their own task queue (`phone-astra`, `phone-nimbus`, `phone-orion`) with its own worker in the backend process.
An optional `PHONE_<PROVIDER>_MAX_PER_SECOND` sets the worker's `maxTaskQueueActivitiesPerSecond`, which the Temporal server enforces across all workers.
A 429 answer throws a retryable `ApplicationFailure` with `nextRetryDelay` taken from `Retry-After`, which the installed SDK supports.

Alternatives considered:

- Worker `maxActivitiesPerSecond` on one shared queue, rejected because it limits per worker process, not per provider across workers.
- A token bucket in the database, rejected because Temporal already provides server-side task queue limits.

### Decision 5: Data model

| Field on `lead` | Type | Purpose |
| --- | --- | --- |
| `phoneEnrichmentStatus` | enum `NOT_STARTED`, `PENDING`, `FOUND`, `NOT_FOUND`, `FAILED` | Outcome and polling trigger |
| `phoneEnrichmentProgress` | `Json`, nullable | `{ provider, position, total }` while a provider is being tried, so the table can show "Trying Nimbus Lookup (2/3)"; changed from a provider enum during implementation, because the UI also needs the position and total |
| `phoneSource` | enum `IMPORT`, `ASTRA`, `NIMBUS`, `ORION`, nullable | Where the current phone came from |
| `phoneEnrichmentAttempts` | `Json`, nullable | Per-provider result of the last lookup: skipped with reason, not found, errored, or found |
| `phoneEnrichedAt` | `DateTime`, nullable | When the last lookup ended |

Prisma 6.15 accepts `Json` on SQLite, which was verified with `prisma validate`.
Imported phones get `phoneSource = IMPORT`.

### Decision 6: Phone formatting with `libphonenumber-js`

A found number is parsed with the provider's country, else the lead's country, and stored as E.164 when valid, else as returned.
Nimbus sends the number as a JSON number, so leading zeros may be lost, and the raw value is kept in the attempts record for diagnosis.

### Decision 7: Credentials and configuration

`backend/.env` (already gitignored) holds `ASTRA_API_KEY`, `NIMBUS_API_KEY`, `ORION_API_KEY`, the three base URLs, the provider order `PHONE_PROVIDER_ORDER=ASTRA,NIMBUS,ORION`, and optional rate limits.
`backend/.env.sample` documents them, replacing its stale MySQL example.
The backend loads the file with `process.loadEnvFile` when present, validates the configuration at startup, and refuses to start the phone workers when a key is missing.

### Decision 8: Start endpoint and UI

`POST /leads/enrich-phone` takes `{ leadIds, force }`, skips leads with a phone unless `force` is true, sets started leads to `PENDING`, starts workflows concurrently, and responds 202 with `{ started, skipped, failed }`.
During implementation, `force` stayed in the endpoint, so the workflow takes only the lead id, and `failed` lists leads whose workflow could not be started; they are marked `FAILED`.
The Enrich menu gets "Enrich Phone", and a row with a phone gets "Re-enrich phone" behind a confirmation.
The phone cell shows "Trying Nimbus Lookup (2/3)" while pending, the phone with a source badge when found, "No data found", or "Failed" with a retry button.
The leads query's existing poll-while-pending condition from the email fix extends to `phoneEnrichmentStatus`.

## Risks / Trade-offs

- [Orion is skipped for most free-mail leads] → Accepted by product decision, and the skip reason is visible per lead.
- [The mocks return random results] → Tests stub `fetch` per provider, and the end-to-end check asserts that each lead reaches some outcome, not a specific number.
- [Nimbus's response differs from the README] → The normalizer accepts both field names, with tests for each.
- [Three more workers in the API process] → They share one native connection, and splitting workers into their own process stays a separate improvement.
- [Secrets were committed in the README] → They are test keys for this exercise, and real keys must only ever live in `.env`.

## Migration Plan

1. Merge `fix-email-verification-stall` and `add-lead-fields`.
2. Create `backend/.env` from `.env.sample` with the provider keys.
3. Apply the migration, which adds the enrichment fields and sets `phoneSource = IMPORT` for leads that already have a phone.
4. Deploy the backend and frontend together.

Rollback: revert the code, which leaves the added columns unused, and remove the phone task queues' pending workflows with `temporal workflow terminate` if any remain.
