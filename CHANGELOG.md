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

### Changed

- Ignore local agent worktrees and pnpm-generated `pnpm-workspace.yaml` files in git.
- The bulk import converts country values to ISO 3166-1 alpha-2 codes from codes, ISO numbers, the `UK` and `EL` aliases, and English names, and leaves unrecognized values blank.
- The frontend lints with an ESLint 9 flat config.

### Fixed

- CSV imports no longer store or display invalid country values such as `XXX` and `12` ([FIX-001](design/fixes/FIX-001-csv-country-codes.md)).
- The seeded `UK` country in `dev.db` is now `GB`.
- The frontend build no longer fails on a type error in the mutation registry, and `pnpm lint` runs again.
- Valid rows in the CSV import preview no longer show a red dash in the Errors column.
