# phone-enrichment Specification

## Purpose

Lets users find missing lead phone numbers through external providers in the background, with bounded, deduplicated lookups whose progress and outcome are recorded and visible.

## Requirements

### Requirement: Enrichment status per lead
Each lead SHALL have one phone enrichment status: `NOT_STARTED`, `PENDING`, `FOUND`, `NOT_FOUND`, or `FAILED`, and new leads SHALL start as `NOT_STARTED`.

#### Scenario: New lead
- **WHEN** a lead is created or imported
- **THEN** its phone enrichment status is `NOT_STARTED`

### Requirement: Starting enrichment returns immediately
Starting enrichment for selected leads SHALL respond with status 202 without waiting for any lookup, SHALL set each started lead to `PENDING`, and SHALL list the started and skipped leads.

#### Scenario: Start
- **WHEN** the user starts enrichment for two leads without phones
- **THEN** the request responds with 202 in under one second, both leads are `PENDING`, and both are listed as started

### Requirement: Leads with a phone are skipped unless re-enriched
Starting enrichment SHALL skip leads that already have a phone and list them with the reason, unless the user explicitly requests re-enrichment, which SHALL replace the phone when a new one is found.

#### Scenario: Lead already has a phone
- **WHEN** the user starts enrichment for a lead whose phone is `555-0100`
- **THEN** no lookup starts for that lead and it is listed as skipped because it already has a phone

#### Scenario: Re-enrich
- **WHEN** the user chooses Re-enrich phone for that lead and a provider finds `+15550199`
- **THEN** the lead's phone becomes `+15550199`

### Requirement: Providers are tried in configured order and stop at the first phone
The lookup SHALL try providers in the configured order, by default Astra Dialer, then Nimbus Lookup, then Orion Connect, and SHALL stop at the first provider that returns a phone.

#### Scenario: First provider finds a phone
- **WHEN** Astra Dialer returns a phone for a lead
- **THEN** Nimbus Lookup and Orion Connect are not called, and the lead is `FOUND` with source Astra Dialer

#### Scenario: Later provider finds a phone
- **WHEN** Astra Dialer and Nimbus Lookup return no phone and Orion Connect returns one
- **THEN** the lead is `FOUND` with source Orion Connect

### Requirement: Providers without their inputs are skipped
A provider SHALL be skipped, without being called, when the lead lacks its required inputs, and the skip and its reason SHALL be recorded.

#### Scenario: No job title for Nimbus
- **WHEN** a lead has no job title
- **THEN** Nimbus Lookup is skipped with the reason that the job title is missing

#### Scenario: Free email for Orion
- **WHEN** a lead's email is `ada@gmail.com`
- **THEN** Orion Connect is skipped with the reason that there is no business domain

#### Scenario: Business email for Orion
- **WHEN** a lead's email is `pamela26@walker.com`
- **THEN** Orion Connect is called with the company website `walker.com`

### Requirement: Final outcome
A lookup SHALL end `FOUND` when a provider returns a phone, `NOT_FOUND` when every attempted provider answered without a phone, and `FAILED` when at least one provider errored after all its attempts and none returned a phone.
Skipped providers SHALL not make a lookup `FAILED`.

#### Scenario: Every provider answers empty
- **WHEN** Astra Dialer and Nimbus Lookup answer without a phone and Orion Connect is skipped
- **THEN** the lead is `NOT_FOUND`

#### Scenario: A provider keeps failing
- **WHEN** Astra Dialer answers without a phone and Nimbus Lookup returns server errors on every attempt and Orion Connect answers without a phone
- **THEN** the lead is `FAILED`

### Requirement: Provider calls are bounded
Each provider call SHALL have a per-attempt time limit and at most three attempts with exponential backoff, and SHALL not be retried after a request error such as missing input or invalid credentials.
A lookup SHALL reach its outcome within 90 seconds while the workers run.

#### Scenario: Provider times out
- **WHEN** a provider does not answer within its time limit on all three attempts
- **THEN** that provider is recorded as errored and the lookup continues with the next provider

#### Scenario: Invalid credentials
- **WHEN** a provider answers 401
- **THEN** it is not retried and is recorded as errored

### Requirement: One lookup per lead at a time
The system SHALL run at most one lookup per lead at a time, and SHALL allow a new lookup once the previous one has ended.

#### Scenario: Repeated start while pending
- **WHEN** the user starts enrichment for a lead that is `PENDING`
- **THEN** no second lookup starts and the lead stays `PENDING`

### Requirement: Found numbers are formatted consistently
A found phone SHALL be stored in E.164 format when it can be parsed with the provider's country or the lead's country, and SHALL otherwise be stored as the provider returned it.

#### Scenario: Nimbus number with country
- **WHEN** Nimbus Lookup returns number `612345678` with country `ES`
- **THEN** the stored phone is `+34612345678`

### Requirement: Progress and outcome are visible
The leads table SHALL show, for a `PENDING` lead, which provider is being tried and its position in the order, SHALL show the outcome and the source provider when the lookup ends, and SHALL refresh without a page reload while any lookup is pending.

#### Scenario: Progress
- **WHEN** a lead's lookup is calling Nimbus Lookup
- **THEN** its phone cell shows that Nimbus Lookup is being tried, as step 2 of 3

#### Scenario: Outcome appears without reload
- **WHEN** a pending lookup ends
- **THEN** the table shows the outcome within five seconds without a page reload

#### Scenario: Failed lead can be retried
- **WHEN** a lead's lookup is `FAILED`
- **THEN** its phone cell offers to try again

### Requirement: Provider credentials come from configuration
Provider credentials SHALL be read from environment variables, and the backend SHALL refuse to start the enrichment worker when a required credential is missing.

#### Scenario: Missing key
- **WHEN** the backend starts without the Astra Dialer key configured
- **THEN** it reports which variable is missing and does not start the enrichment worker

### Requirement: Rate limits are configurable per provider
Each provider SHALL have an optional calls-per-second limit set by configuration and enforced across all workers, and a provider answer of 429 SHALL be retried no sooner than its `Retry-After` value.

#### Scenario: Configured limit
- **WHEN** the Orion Connect limit is set to 2 calls per second and 10 lookups reach Orion at once
- **THEN** Orion Connect receives at most 2 calls per second

#### Scenario: Provider asks to slow down
- **WHEN** a provider answers 429 with `Retry-After: 5`
- **THEN** the next attempt to that provider happens no sooner than 5 seconds later
