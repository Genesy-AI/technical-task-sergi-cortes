# Tasks

## 1. Reproduce the bug end to end

- [x] 1.1 Start `temporal server start-dev`, the backend, and the frontend, select Jane Smith and one other lead, run Verify Email from the UI, and verify the request never completes and neither lead updates, recording the Temporal UI retry history and a screenshot in `design/fixes/FIX-002-email-verification-stall.md`

## 2. Test infrastructure

- [x] 2.1 Split `backend/src/index.ts` into an exported Express app and an entry point that listens and starts the worker, skipping this task if `fix-csv-country-codes` already did it, and verify `pnpm dev` still serves `GET /leads`
- [x] 2.2 Add `supertest`, a test database setup, and `@temporalio/testing` to the backend, and verify a smoke API test and a smoke workflow test pass with `pnpm exec vitest run`
- [x] 2.3 Fix the pre-existing frontend type error in `useApiMutation.ts` and migrate ESLint to a flat config, skipping whatever another change already fixed, and verify `pnpm build` and `pnpm lint` pass in the frontend
- [x] 2.4 Write a failing workflow test showing that verifying `jane.smith@example.com` does not finish within 30 seconds of skipped time, and verify it fails for the documented reason

## 3. Verification status model

- [x] 3.1 Write a migration test that seeds verified, not verified, and never checked leads and asserts the mapped statuses, and verify it fails before the migration exists
- [x] 3.2 Add the `EmailVerificationStatus` enum and the hand-edited data migration that drops `emailVerified`, and verify the test from 3.1 passes and new leads default to `UNVERIFIED`

## 4. Workflow and activities

- [x] 4.1 Write workflow tests with time skipping for the verified, invalid, and failed outcomes, the 30-second bound, and cancellation of timed-out attempts, and verify they fail before implementation
- [x] 4.2 Make `verifyEmail` heartbeat and wait with the cancellable context sleep, set the activity options from design.md, and verify the outcome and cancellation tests pass
- [x] 4.3 Add the `saveVerificationResult` activity and the failure mapping in the workflow, and verify the workflow tests from 4.1 and 2.4 pass

## 5. Start endpoint

- [x] 5.1 Write API tests for `202` with started ids, `PENDING` status, `404` for unknown ids, request validation, idempotent repeated starts, re-run after `FAILED`, and leads set to `FAILED` when a start fails, and verify they fail before implementation
- [x] 5.2 Implement the endpoint with the shared lazy Temporal client, per-lead workflow ids, and the conflict and reuse policies, and verify the tests from 5.1 pass
- [x] 5.3 Return `emailVerificationStatus` from lead endpoints instead of `emailVerified`, and verify an API test for `GET /leads` asserts the new field

## 6. Frontend

- [x] 6.1 Update lead and verify-emails types and the optimistic lead in `useApiMutation.ts`, and verify `tsc -b` passes
- [x] 6.2 Write component tests for the pending spinner, the four outcome displays, the started toast, polling while pending, and the retry action for `FAILED`, and verify they fail before implementation
- [x] 6.3 Implement the email cell, polling, toasts, and retry action, and verify the tests from 6.2 pass

## 7. Documentation

- [x] 7.1 Record the start-then-observe pattern and per-lead workflow ids as a decision in `design/decisions`, linked to this change, and verify the file exists
- [x] 7.2 Update `design/architecture/02-backend.md`, `03-frontend.md`, and `04-features.md` for the new flow and status model, and verify the defect is marked resolved in `05-assessment.md`
- [x] 7.3 Add the fix and the breaking API change to `CHANGELOG.md`, and verify the entry follows Keep a Changelog

## 8. End-to-end verification

- [ ] 8.1 Repeat the scenario from 1.1 against `temporal server start-dev`, and verify the request returns at once, the other lead becomes verified, and Jane Smith becomes failed within 30 seconds, recording a screenshot in the fix document
- [ ] 8.2 Close the page during a verification, reopen it, and verify the recorded outcome is shown
- [ ] 8.3 Run all backend and frontend tests, type checks, and lint, and verify they pass

## Workflow follow-up

- Archive the change after review approval with `/opsx:archive`.
