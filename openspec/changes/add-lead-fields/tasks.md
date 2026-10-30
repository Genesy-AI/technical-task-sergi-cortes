# Tasks

## 1. Baseline

- [x] 1.1 Rebase on `main` after `fix-email-verification-stall` merges, and verify all backend and frontend tests, type checks, and lint pass before any change
- [x] 1.2 Import `docs/leads-ok-1.csv` through the UI and verify the phone and years columns are dropped, recording screenshots in `design/features/add-lead-fields.md`

## 2. Data model

- [x] 2.1 Write a migration test that seeds leads before the migration and asserts each gets one current role copied from its job title and company, and verify it fails first
- [x] 2.2 Add `phone`, `linkedinUrl`, and the `leadRole` table with the migration, and verify the test from 2.1 passes and `prisma migrate diff` reports no drift

## 3. Lead field registry and value rules

- [x] 3.1 Write unit tests for the phone, LinkedIn, and years rules from the `lead-profile` spec, and verify they fail first
- [x] 3.2 Implement the rules and the registry in `backend/src/leads/`, and verify the tests from 3.1 pass
- [x] 3.3 Add `GET /leads/fields` with an API test asserting keys, labels, groups, and column defaults, and verify it passes

## 4. Import

- [x] 4.1 Write tests for header mapping and aliases, grouping by email, current-role selection, person-level conflicts, and invalid values, and verify they fail first
- [x] 4.2 Implement the shared import function and `POST /leads/import/preview` with request limits, and verify the tests from 4.1 pass
- [x] 4.3 Make `POST /leads/bulk` use the same function and detect existing leads by email, and verify API tests for duplicates by email and same-name different-email pass
- [x] 4.4 Remove `POST /leads/country-codes/normalize` and its tests, and verify the `lead-country-code` scenarios still pass through the new preview
- [x] 4.5 Switch the import modal to the backend preview, showing grouped leads, roles, and notes, and verify with component tests

## 5. Leads API and table

- [x] 5.1 Return phone, LinkedIn URL, roles, current role, years in role, and years at company from `GET /leads`, and verify with API tests for the summing scenarios
- [x] 5.2 Add the column menu, sticky name column, truncation, `tel:` links, and safe LinkedIn links, and verify with component tests including persistence

## 6. Message composition

- [x] 6.1 Drive the generator's allow-list from the registry and add generator tests for the new fields, and verify they pass
- [x] 6.2 Replace the chip row with the grouped searchable picker and add missing-field warnings, and verify with component tests for search, insertion, and counts

## 7. Documentation

- [ ] 7.1 Record the field registry and backend import preview decisions in `design/decisions`, linked to this change, and verify the files exist
- [ ] 7.2 Update `design/architecture` for the new model, endpoints, and UI, mark finding A2 resolved, and add the change to `CHANGELOG.md` with its breaking items, and verify the links resolve

## 8. End-to-end verification

- [x] 8.1 Import every file in `docs/` through the UI and verify phones, years, and grouped roles appear, recording screenshots in the feature document
- [x] 8.2 Generate a message using `{phone}` and `{yearsAtCompany}` for leads with and without those values, and verify the warning and the skipped leads in the UI
- [ ] 8.3 Run all tests, type checks, builds, and lint in both packages, and verify they pass

## Workflow follow-up

- Archive the change after review approval with `/opsx:archive`.
