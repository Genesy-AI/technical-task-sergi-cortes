# 0005 - Phone providers share one skip, call, and normalize abstraction

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related change:** [enrich-lead-phone](../../openspec/changes/archive/2026-10-30-enrich-lead-phone/design.md)

## Decision

Each phone provider in `backend/src/phoneEnrichment/providers` implements one `PhoneProvider` contract.
`inputFrom(lead)` builds the provider's request or returns a skip reason, `call` performs the HTTP request with the configured key, and `normalize` turns the raw answer into a phone or "not found".
`backend/src/phoneEnrichment/catalog.ts` lists the providers with their labels, task queues, and attempt time limits, and `PHONE_PROVIDER_ORDER` chooses which run and in which order.
HTTP status handling lives once in `lookup.ts`: 400, 401, and 403 fail without retry, a 429 retries after its `Retry-After`, and server errors, network errors, and timeouts are retried.

## Why

The three providers differ only in their inputs, their answer shapes, and when they cannot be asked.
Keeping those differences behind one contract lets the workflow loop over providers without knowing any of them, and records every skip, miss, and error in the same attempts format the table shows.
Adding a provider is a new module and a catalog entry, with no workflow change.

## Alternatives considered

- One activity per provider with its own error handling was rejected, because retry and status rules would be repeated three times and drift.
- A hand-written list of free email domains for Orion's skip rule was rejected in favor of the maintained `free-email-domains` package.

## Consequences

Provider answers that do not fit `normalize`, such as Nimbus sending the number as a JSON number, are handled in that provider's module, and the raw value is kept in the attempts record for diagnosis.
