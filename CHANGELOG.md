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
- Main OpenSpec spec `email-verification`, synced from the archived `fix-email-verification-stall` change.
- Per-row email verification status in the leads table, with a spinner while verifying and a Retry button when a check could not complete.
- Temporal workflow tests with `@temporalio/testing` time skipping, and API tests that run the verify endpoint against a Temporal test server.
- `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, and `TEMPORAL_TASK_QUEUE` environment variables, with the previous values as defaults.
- Lead phone number, LinkedIn profile URL, and role history, with years in role and years at company summed over the roles at the current company ([feature](design/features/add-lead-fields.md)).
- CSV columns `phoneNumber`, `linkedinUrl`, `yearsInRole`, and `isCurrentRole`, with aliases such as `Phone` and `LinkedIn Profile`.
- A backend lead field registry served by `GET /leads/fields`, which drives the import mapping, template fields, and table columns.
- `POST /leads/import/preview`, which returns what an import would store per person, with notes for converted, cleared, conflicting, and merged values.
- A column menu for the leads table, remembered per browser, with phone as a `tel:` link and LinkedIn as a link opening in a new tab.
- A grouped, searchable field picker in the message composer, with warnings for fields missing in some selected leads.
- `docs/leads-roles.csv` sample with people who held several roles.
- Main OpenSpec specs `lead-profile`, `lead-import`, `message-composition`, and `leads-table`, synced from the archived `add-lead-fields` change.
- Phone enrichment that tries Astra Dialer, Nimbus Lookup, and Orion Connect in order until one finds a phone, as one Temporal workflow per lead ([feature](design/features/enrich-lead-phone.md)).
- `POST /leads/enrich-phone { leadIds, force? }`, which skips leads that have a phone unless `force` is set, and responds `202 { started, skipped, failed }`.
- Lead fields `phoneSource`, `phoneEnrichmentStatus`, `phoneEnrichmentProgress`, `phoneEnrichmentAttempts`, and `phoneEnrichedAt`, with existing phones marked as imported.
- An "Enrich Phone" action, per-row progress with the provider being tried, the source of a found phone, Retry for failed lookups, and a confirmed Re-enrich.
- `backend/.env` loading at startup, with provider keys, base URLs, `PHONE_PROVIDER_ORDER`, and per-provider `PHONE_<PROVIDER>_MAX_PER_SECOND` limits documented in `backend/.env.sample`.
- Decisions [0005](design/decisions/0005-phone-provider-abstraction.md) and [0006](design/decisions/0006-one-task-queue-per-phone-provider.md) on the provider abstraction and per-provider task queues.

### Changed

- **BREAKING:** leads expose `emailVerificationStatus` (`UNVERIFIED`, `PENDING`, `VERIFIED`, `INVALID`, `FAILED`) instead of the `emailVerified` boolean, and a migration maps existing values.
- **BREAKING:** `POST /leads/verify-emails` starts verification in the background and responds `202 { started, failed }` instead of waiting for results.
- Email verification runs one workflow per lead with id `verify-email-{leadId}`, so repeated starts join the running verification.
- All Temporal packages are aligned on 1.13.2.
- **BREAKING:** `POST /leads/bulk` takes the raw CSV rows as `{ rows }` and responds with `invalidRows` instead of `invalidLeads`.
- **BREAKING:** imports detect existing leads by email instead of first and last name, and rows sharing an email become one lead with several roles.
- **BREAKING:** `POST /leads/country-codes/normalize` is removed in favor of `POST /leads/import/preview`.
- The leads table pins the selection and name columns while the other columns scroll horizontally.
- Ignore local agent worktrees in git, and track each package's `pnpm-workspace.yaml`, which records the allowed dependency build scripts.
- The bulk import converts country values to ISO 3166-1 alpha-2 codes from codes, ISO numbers, the `UK` and `EL` aliases, and English names, and leaves unrecognized values blank.
- The frontend lints with an ESLint 9 flat config.

### Fixed

- CSV imports no longer store or display invalid country values such as `XXX` and `12` ([FIX-001](design/fixes/FIX-001-csv-country-codes.md)).
- The seeded `UK` country in `dev.db` is now `GB`.
- The frontend build no longer fails on a type error in the mutation registry, and `pnpm lint` runs again.
- Valid rows in the CSV import preview no longer show a red dash in the Errors column.
- Email verification no longer hangs: checks are limited to three five-second attempts, a check that never answers ends as failed, and one slow lead no longer blocks the others ([FIX-002](design/fixes/FIX-002-email-verification-stall.md)).
- Timed-out verification attempts are cancelled instead of continuing to run in the worker.
- Identical rows for one person in a CSV are no longer imported twice (finding D7).
- Template values containing `$&` or `$1` are inserted literally instead of as replacement patterns (finding D9).
- The leads table no longer clips its last column header; it scrolls horizontally with the name column pinned.
