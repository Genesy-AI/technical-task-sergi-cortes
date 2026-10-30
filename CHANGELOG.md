# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Architecture and code design documentation in `design/architecture`, covering system overview, backend, frontend, feature flows, and a code design assessment.
- Improvement backlog pointer in `design/improvements` linking to the assessment findings.
- OpenSpec initialization with the `spec-driven` schema in `openspec/`, plus the OpenSpec commands and skills for Claude Code in `.claude/`.
- Planned OpenSpec changes `fix-csv-country-codes` and `fix-email-verification-stall`, with bug-fix specs in `design/fixes`.

### Changed

- Ignore local agent worktrees and pnpm-generated `pnpm-workspace.yaml` files in git.
