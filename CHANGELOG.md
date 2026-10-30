# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Architecture and code design documentation in `design/architecture`, covering system overview, backend, frontend, feature flows, and a code design assessment.
- Improvement backlog pointer in `design/improvements` linking to the assessment findings.
- OpenSpec initialization with the `spec-driven` schema in `openspec/`, plus the OpenSpec commands and skills for Claude Code in `.claude/`.
- Planned OpenSpec changes `fix-csv-country-codes` and `fix-email-verification-stall`, with bug-fix specs in `design/fixes`.
- `POST /leads/country-codes/normalize` endpoint that previews how country values will be stored.
- Country column in the CSV import preview, noting values that were converted or not recognized.
- `pnpm db:normalize-countries` backend command that converts stored country values, as a dry run unless `--apply` is given.
- Backend API tests against an isolated SQLite database, a backend `typecheck` script, and frontend component tests with Testing Library.
- Main OpenSpec spec `lead-country-code`, synced from the archived `fix-csv-country-codes` change.
- Planned OpenSpec changes `add-lead-fields` and `enrich-lead-phone`, with feature specs in `design/features`.
- Per-row email verification status in the leads table, with a spinner while verifying and a Retry button when a check could not complete.
- Temporal workflow tests with `@temporalio/testing` time skipping, and API tests that run the verify endpoint against a Temporal test server.
- `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, and `TEMPORAL_TASK_QUEUE` environment variables, with the previous values as defaults.

### Changed

- **BREAKING:** leads expose `emailVerificationStatus` (`UNVERIFIED`, `PENDING`, `VERIFIED`, `INVALID`, `FAILED`) instead of the `emailVerified` boolean, and a migration maps existing values.
- **BREAKING:** `POST /leads/verify-emails` starts verification in the background and responds `202 { started, failed }` instead of waiting for results.
- Email verification runs one workflow per lead with id `verify-email-{leadId}`, so repeated starts join the running verification.
- All Temporal packages are aligned on 1.13.2.

- Ignore local agent worktrees and pnpm-generated `pnpm-workspace.yaml` files in git.
- The bulk import converts country values to ISO 3166-1 alpha-2 codes from codes, ISO numbers, the `UK` and `EL` aliases, and English names, and leaves unrecognized values blank.
- The frontend lints with an ESLint 9 flat config.

### Fixed

- CSV imports no longer store or display invalid country values such as `XXX` and `12` ([FIX-001](design/fixes/FIX-001-csv-country-codes.md)).
- The seeded `UK` country in `dev.db` is now `GB`.
- The frontend build no longer fails on a type error in the mutation registry, and `pnpm lint` runs again.
- Valid rows in the CSV import preview no longer show a red dash in the Errors column.
- Email verification no longer hangs: checks are limited to three five-second attempts, a check that never answers ends as failed, and one slow lead no longer blocks the others ([FIX-002](design/fixes/FIX-002-email-verification-stall.md)).
- Timed-out verification attempts are cancelled instead of continuing to run in the worker.
