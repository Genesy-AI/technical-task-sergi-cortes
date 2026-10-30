# Proposal

## Why

Verifying the email of some leads, such as `jane.smith@example.com`, never finishes and never reports success or failure.
The verification activity has a one-second time limit and unlimited retries, so a slow check retries forever, and the HTTP request waits on it while the UI shows no progress.
Users cannot tell whether a lead's email is usable, and one slow lead blocks the result of every other lead in the same request.

## What Changes

- Starting verification returns immediately, marks the selected leads as pending, and runs one verification per lead in the background.
- Every verification ends in exactly one outcome: verified, invalid, or failed when the check exceeds its time limit on every attempt.
- Verification time is bounded by a limited number of attempts, each with a short time limit.
- At most one verification runs per lead at a time, so repeated clicks do not start duplicates, and a finished lead can be verified again.
- The leads table shows a pending indicator per row, updates as outcomes arrive without a page reload, and lets the user re-run failed verifications.
- **BREAKING:** the lead's `emailVerified` boolean is replaced by an `emailVerificationStatus` field with the values `UNVERIFIED`, `PENDING`, `VERIFIED`, `INVALID`, and `FAILED`, and existing values are migrated.
- **BREAKING:** `POST /leads/verify-emails` responds with `202 Accepted` and the leads it started, instead of waiting for and returning verification results.

## Capabilities

### New Capabilities

- `email-verification`: How lead email verification is started, bounded in time, deduplicated per lead, recorded as an outcome, and shown to the user.

### Modified Capabilities

None.

## Impact

- **Backend:** Prisma schema and a data migration, the verify-emails endpoint, the Temporal workflow and activities, a reused Temporal client, and a new activity that saves the outcome.
- **Frontend:** lead types, the email cell in the leads table, polling while any lead is pending, toasts, and a re-run action for failed rows.
- **Dependencies:** adds `@temporalio/testing` and `supertest` as backend development dependencies.
- **API consumers:** any client reading `emailVerified` or the old synchronous response must move to the new field and response.
