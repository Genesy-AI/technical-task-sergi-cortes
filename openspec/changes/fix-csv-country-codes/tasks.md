# Tasks

## 1. Reproduce the bug end to end

- [ ] 1.1 Start the backend, Temporal, and frontend, import `docs/leads-with-errors.csv` through the UI, and verify the table shows `XXX` and `12` as countries, recording a screenshot in `design/fixes/FIX-001-csv-country-codes.md`
- [ ] 1.2 Write a failing API test that posts the sample file's rows to `/leads/bulk` and asserts no stored country is `XXX` or `12`, and verify it fails for the documented reason

## 2. Testable backend app

- [ ] 2.1 Split `backend/src/index.ts` into an exported Express app and an entry point that listens and starts the worker, skipping this task if `fix-email-verification-stall` already did it, and verify `pnpm dev` still serves `GET /leads`
- [ ] 2.2 Add `supertest` and a test database setup to the backend, and verify a smoke test for `GET /leads` passes with `pnpm exec vitest run`
- [ ] 2.3 Fix the pre-existing frontend type error in `useApiMutation.ts` and migrate ESLint to a flat config, skipping whatever another change already fixed, and verify `pnpm build` and `pnpm lint` pass in the frontend

## 3. Country conversion module

- [ ] 3.1 Add `i18n-iso-countries` pinned to major version 7, and verify installation with `pnpm install --frozen-lockfile`
- [ ] 3.2 Write unit tests for every scenario in the `lead-country-code` spec for conversion, names, and blanks, including `Congo` and `Korea` as ambiguous, and verify they fail before implementation
- [ ] 3.3 Implement the module with the resolution order and reverse name index from design.md, and verify all tests from 3.2 pass

## 4. Import and preview

- [ ] 4.1 Apply the conversion in the `/leads/bulk` handler, and verify the test from 1.2 now passes
- [ ] 4.2 Add `POST /leads/country-codes/normalize` with request validation and API tests for valid, converted, cleared, and malformed requests, and verify the tests pass
- [ ] 4.3 Show the converted country and a converted or not-recognized note per row in the CSV import modal, with a fallback note when the endpoint fails, and verify with component tests
- [ ] 4.4 Update the modal help text to describe accepted country formats, and verify it renders in the component test

## 5. Backfill

- [ ] 5.1 Write tests for the backfill against a test database covering dry run, apply, and re-run, and verify they fail before implementation
- [ ] 5.2 Implement the script and the `db:normalize-countries` package script, and verify the tests from 5.1 pass
- [ ] 5.3 Run the dry run against `dev.db`, then apply it, and verify the only change is `UK` to `GB`, recording the output in the fix document

## 6. Documentation

- [ ] 6.1 Record the "backend owns conversion with a preview endpoint" decision in `design/decisions`, linked to this change, and verify the file exists
- [ ] 6.2 Update `design/architecture/02-backend.md` and `03-frontend.md` for the new endpoint, module, and preview, and verify the defect is marked resolved in `05-assessment.md`
- [ ] 6.3 Add the fix to `CHANGELOG.md` under Fixed, and verify the entry follows Keep a Changelog

## 7. End-to-end verification

- [ ] 7.1 Import `docs/leads-with-errors.csv` through the UI again, and verify the preview notes and the table show only valid codes or blanks, recording a screenshot in the fix document
- [ ] 7.2 Run all backend and frontend tests, type checks, and lint, and verify they pass

## Workflow follow-up

- Archive the change after review approval with `/opsx:archive`.
