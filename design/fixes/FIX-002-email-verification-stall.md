# FIX-002 - Email verification never finishes for some leads

| Field | Value |
| --- | --- |
| Fix ID | FIX-002 |
| OpenSpec change | [fix-email-verification-stall](../../openspec/changes/fix-email-verification-stall/proposal.md) |
| Capability | `email-verification` |
| Assessment findings | D1, A4, and A5 in [05-assessment.md](../architecture/05-assessment.md) |
| Status | Planned |

## Symptom

Running "Verify Email" on some leads never reports success or failure, and the UI shows no progress.

## Reproduction

1. Start `temporal server start-dev`, the backend, and the frontend.
2. Select Jane Smith (`jane.smith@example.com`) and one other lead.
3. Open "Enrich" and click "Verify Email".
4. Wait more than one minute.

## Expected

The request returns quickly, each lead shows that verification is in progress, and each lead ends as verified, invalid, or failed.

## Actual

The request never completes, no toast appears, and neither lead's status changes.
The Temporal UI shows the `verifyEmail` activity timing out and retrying without end.

## Root cause

The `verifyEmail` activity has a one-second time limit and no retry policy, so the server default of unlimited retries applies.
The mock check for `jane.smith` takes 20 seconds, so every attempt times out and the workflow never finishes.
The API awaits each workflow result in sequence inside the HTTP request, so one stuck lead blocks the whole response.
The timed-out attempts cannot be cancelled, so each one keeps sleeping in the worker.

## Fix summary

Verification starts in the background and returns immediately, and each lead gets a stored status: unverified, pending, verified, invalid, or failed.
Attempts are limited to three with a five-second limit each, so a stuck check ends as failed in about 18 seconds.
The workflow records the outcome itself, one workflow runs per lead at a time, and the table polls while any lead is pending.
See the change's design.md for details.

## Evidence

Reproduction screenshot, Temporal retry history, and verification screenshots are added here during tasks 1.1, 8.1, and 8.2.
