# Spec Delta

## Purpose

Lets users verify lead emails in the background and guarantees that every verification reaches a visible, recorded outcome within bounded time.

## ADDED Requirements

### Requirement: Verification status per lead
Each lead SHALL have exactly one email verification status: `UNVERIFIED`, `PENDING`, `VERIFIED`, `INVALID`, or `FAILED`.
A newly created or imported lead SHALL start as `UNVERIFIED`.

#### Scenario: New lead
- **WHEN** a lead is created or imported
- **THEN** its email verification status is `UNVERIFIED`

#### Scenario: Status exposed by the API
- **WHEN** a client lists leads
- **THEN** every lead includes its `emailVerificationStatus`

### Requirement: Starting verification returns immediately
Starting verification for a set of leads SHALL respond without waiting for any verification to finish, and SHALL set each started lead to `PENDING`.

#### Scenario: Start returns before outcomes
- **WHEN** the user starts verification for leads whose checks take 20 seconds
- **THEN** the request responds with status 202 in under one second and lists the started lead ids
- **AND** each started lead's status is `PENDING`

#### Scenario: Unknown leads
- **WHEN** the user starts verification with ids that match no lead
- **THEN** the request responds with status 404 and no lead changes status

### Requirement: Every verification reaches an outcome
Each started verification SHALL end with status `VERIFIED` when the email passes the check, `INVALID` when the check rejects it, or `FAILED` when the check cannot complete.

#### Scenario: Email passes
- **WHEN** verification runs for an email the check accepts
- **THEN** the lead's status becomes `VERIFIED`

#### Scenario: Email rejected
- **WHEN** verification runs for `john.doe@example.com` or an email containing `+`
- **THEN** the lead's status becomes `INVALID`

#### Scenario: Check never completes in time
- **WHEN** verification runs for `jane.smith@example.com`, whose check takes 20 seconds
- **THEN** the lead's status becomes `FAILED`

### Requirement: Verification time is bounded
A verification whose check keeps exceeding its time limit SHALL reach `FAILED` within 30 seconds of starting while the verification worker is running.

#### Scenario: Slow check fails in bounded time
- **WHEN** verification starts for `jane.smith@example.com` with the worker running
- **THEN** the lead's status is `FAILED` no later than 30 seconds after the start

### Requirement: One verification per lead at a time
The system SHALL run at most one verification per lead at a time, and SHALL allow a new verification once the previous one has ended.

#### Scenario: Repeated start while pending
- **WHEN** the user starts verification for a lead that is already `PENDING`
- **THEN** no second verification starts for that lead and the lead stays `PENDING`

#### Scenario: Re-run after an outcome
- **WHEN** the user starts verification for a lead whose status is `FAILED`
- **THEN** a new verification starts and the lead becomes `PENDING`

### Requirement: Leads are verified independently
A slow or failing verification SHALL NOT delay the outcome of other leads started in the same request.

#### Scenario: Mixed batch
- **WHEN** the user starts verification for `jane.smith@example.com` and a lead whose check passes immediately
- **THEN** the second lead's status becomes `VERIFIED` while the first is still `PENDING`

### Requirement: Outcomes do not depend on the client
A started verification SHALL complete and record its outcome even if the user closes the page or the API restarts.

#### Scenario: Page closed during verification
- **WHEN** the user starts verification and closes the page before it finishes
- **THEN** reopening the page later shows the recorded outcome

### Requirement: Verification progress is visible in the leads table
The leads table SHALL show each lead's verification status, SHALL show a progress indicator for `PENDING` leads, and SHALL refresh outcomes without a page reload while any lead is `PENDING`.

#### Scenario: Pending indicator
- **WHEN** a lead's status is `PENDING`
- **THEN** its email cell shows a progress indicator

#### Scenario: Outcome appears without reload
- **WHEN** a pending lead's verification ends
- **THEN** the table shows the new status within five seconds without a page reload

#### Scenario: Start feedback
- **WHEN** the user starts verification for three leads
- **THEN** the user sees a confirmation that verification started for three leads

### Requirement: Failed verifications can be retried from the table
A lead with status `FAILED` SHALL be visually distinct from `INVALID`, and the user SHALL be able to start its verification again from the table.

#### Scenario: Retry failed lead
- **WHEN** the user triggers the retry action on a `FAILED` lead
- **THEN** a new verification starts and the lead shows as `PENDING`

### Requirement: Existing verification results are preserved
Upgrading SHALL map each existing lead's previous result to a status: verified to `VERIFIED`, not verified to `INVALID`, and never checked to `UNVERIFIED`.

#### Scenario: Migrating seeded data
- **WHEN** the migration runs on a database where one lead was verified, one was not verified, and one was never checked
- **THEN** their statuses become `VERIFIED`, `INVALID`, and `UNVERIFIED` respectively
