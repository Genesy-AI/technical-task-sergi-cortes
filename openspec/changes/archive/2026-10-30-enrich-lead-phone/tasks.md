# Tasks

## 1. Baseline

- [x] 1.1 Rebase on `main` after `fix-email-verification-stall` and `add-lead-fields` merge, and verify all tests, type checks, and lint pass before any change
- [x] 1.2 Probe each provider endpoint with synthetic inputs and record the response shapes, latencies, and error bodies in `design/features/enrich-lead-phone.md`, and verify they match the design's assumptions

## 2. Configuration and data model

- [x] 2.1 Write tests for loading and validating provider configuration, including a missing key and the provider order, and verify they fail first
- [x] 2.2 Implement configuration loading, `backend/.env.sample`, and README setup notes, and verify the tests from 2.1 pass and no key appears in source
- [x] 2.3 Write a migration test for the enrichment fields and `phoneSource = IMPORT` on existing phones, then add the schema and migration, and verify the test passes

## 3. Providers

- [x] 3.1 Write tests with stubbed `fetch` for each provider's input building, skip reasons, response normalizing (including Nimbus's `phoneNmbr` and `number`), and error mapping for 400, 401, 429, 5xx, and timeouts, and verify they fail first
- [x] 3.2 Implement the provider abstraction, the three providers, business-domain derivation with `free-email-domains`, and E.164 formatting with `libphonenumber-js`, and verify the tests from 3.1 pass

## 4. Workflow

- [x] 4.1 Write time-skipping workflow tests with mocked activities for early stop, skipped providers, the found, not found, and failed outcomes, the 90-second bound, and progress recording, and verify they fail first
- [x] 4.2 Implement the workflow, the lookup and save activities, and one worker per provider queue with optional rate limits, and verify the tests from 4.1 pass
- [x] 4.3 Add a workflow test for 429 with `Retry-After` and for cancellation of a timed-out attempt, and verify they pass

## 5. Start endpoint

- [x] 5.1 Write API tests for 202 with started and skipped leads, the has-phone skip, `force` re-enrichment, idempotent repeated starts, request validation, and start failures, and verify they fail first
- [x] 5.2 Implement `POST /leads/enrich-phone` and return the enrichment fields from `GET /leads`, and verify the tests from 5.1 pass

## 6. Frontend

- [x] 6.1 Write component tests for the Enrich Phone action, per-row progress with provider and step, each outcome, the source badge, retry for failed rows, re-enrich with confirmation, and polling, and verify they fail first
- [x] 6.2 Implement the UI, and verify the tests from 6.1 pass and the build and lint pass

## 7. Documentation

- [x] 7.1 Record the provider abstraction and per-provider task queue decisions in `design/decisions`, linked to this change, and verify the files exist
- [x] 7.2 Update `design/architecture` and `CHANGELOG.md` for the new workflow, endpoint, configuration, and fields, and verify the links resolve

## 8. End-to-end verification

- [x] 8.1 Run the stack with real provider endpoints, enrich several leads with business and free-mail emails and missing job titles from the UI, and verify each reaches an outcome with visible progress and skip reasons, recording screenshots in the feature document
- [x] 8.2 Set an Orion rate limit of 1 per second, enrich 5 leads that reach Orion, and verify from the Temporal history that Orion calls are spaced at least one second apart
- [x] 8.3 Run all tests, type checks, builds, and lint in both packages, and verify they pass

## Workflow follow-up

- Archive the change after review approval with `/opsx:archive`.
