# Proposal

## Why

Many leads have no phone number, and three external providers can find one from what the lead already has.
Each provider needs different inputs, has different speed and reliability, and may add rate limits soon, so lookups must be durable, bounded in time, deduplicated per lead, and visible to the user while they run.

## What Changes

- A new **Enrich Phone** action in the leads table's Enrich menu starts a background phone lookup for the selected leads.
- Each lead's lookup tries providers in a configured order, by default **Astra Dialer, then Nimbus Lookup, then Orion Connect** (fastest first), and stops at the first phone found.
- A **provider abstraction** builds each provider's input from the lead, calls it, and normalizes its response; a provider whose inputs the lead lacks is skipped with a reason instead of failing.
- **Orion Connect** gets its company website from the domain of the lead's email, and is skipped for free email providers such as Gmail.
- Each provider call is bounded: a short time limit per attempt, three attempts with exponential backoff, and no retries for request errors such as missing inputs or bad credentials.
- Each lead ends in **Found** (with the phone and the provider that found it), **No data found** (every attempted provider answered without a phone), or **Failed** (at least one provider errored after its retries and none found a phone).
- At most one lookup runs per lead; leads that already have a phone are skipped unless the user chooses **Re-enrich phone**, which replaces it.
- The table shows per-row progress, including which provider is being tried, and updates without a page reload.
- Provider credentials move from the README to backend environment variables, and per-provider rate limits can be configured without code changes.

## Capabilities

### New Capabilities

- `phone-enrichment`: How a lead's phone is looked up across providers, how the outcome and progress are recorded and shown, and how lookups are deduplicated, bounded, and rate limited.

### Modified Capabilities

None.
The `lead-profile` phone field this change writes to is introduced by `add-lead-fields`, which must merge first.

## Impact

- **Backend:** a provider module, a Temporal workflow and activities, one task queue and worker per provider, a start endpoint, Prisma fields for enrichment status, step, source, attempts, and time, and environment configuration.
- **Frontend:** the Enrich menu, the phone cell's progress and outcome display, a re-enrich action, and polling while lookups run.
- **Dependencies:** `libphonenumber-js` for formatting found numbers.
- **Configuration:** new required environment variables for the three provider keys.
- **Ordering:** builds on the start-and-poll pattern from `fix-email-verification-stall` and on the phone field from `add-lead-fields`, and lands after both.
