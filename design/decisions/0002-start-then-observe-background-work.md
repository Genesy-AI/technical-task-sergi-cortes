# 0002 - Background lead work starts, then the UI observes its status

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related change:** [fix-email-verification-stall](../../openspec/changes/archive/2026-10-30-fix-email-verification-stall/design.md)
- **Related fix:** [FIX-002](../fixes/FIX-002-email-verification-stall.md)

## Decision

Long-running work on leads, starting with email verification, runs as one Temporal workflow per lead.
The API marks the leads `PENDING`, starts the workflows, and responds `202` at once.
Each workflow records its own outcome through an activity, and the leads table polls while any lead is pending.
Workflow ids are derived from the lead (`verify-email-{leadId}`) with `USE_EXISTING` and `ALLOW_DUPLICATE`, so a repeated start joins the running workflow and a start after it ended begins a new run.
Activities have bounded retries, and workflows have no execution timeout, so every run ends in an outcome the workflow itself records.

## Why

Awaiting workflows inside the HTTP request coupled the response to the slowest lead and hid progress from the user.
Recording the outcome from the workflow keeps results durable even when no client is waiting.
Temporal enforces id uniqueness atomically, which a database check before starting cannot do under concurrent requests.

## Alternatives considered

- Keeping the request synchronous with bounded retries was rejected, because a batch of slow leads would still hold the request open.
- Server-sent events were rejected for now, because polling only while something is pending meets the five-second update requirement without new infrastructure.

## Consequences

The planned `enrich-lead-phone` change reuses this pattern with its own status field and workflow id prefix.
