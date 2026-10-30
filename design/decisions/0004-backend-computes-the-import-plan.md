# 0004 - The backend computes the whole import plan

- **Status:** Accepted, extends [0001](0001-backend-owns-country-code-conversion.md)
- **Date:** 2026-10-30
- **Related change:** [add-lead-fields](../../openspec/changes/archive/2026-10-30-add-lead-fields/design.md)

## Decision

The browser only parses the CSV file into raw rows, keeping headers as written.
`buildImport` in `backend/src/leads/importLeads.ts` maps headers, groups rows into people by email, builds each person's role history, validates every value, and marks people whose email already exists.
`POST /leads/import/preview` returns that plan, and `POST /leads/bulk` executes the same plan, so what the user previews is exactly what is stored.
`POST /leads/country-codes/normalize` from decision 0001 is removed, because the plan already includes each converted country with its note.

## Why

Grouping rows and choosing the current role are rules that would otherwise exist in two places, which is the drift decision 0001 avoided for countries.
One plan also lets the preview explain every conversion, merge, conflict, and rejection in the user's own row numbers.

## Alternatives considered

- Keeping validation in the browser parser was rejected, because the backend must enforce the rules for any client anyway.
- Keeping the country endpoint next to the import preview was rejected, because it would be a second, partial preview of the same data.

## Consequences

The preview needs a network round trip after parsing, and requests are limited to 5000 rows and a 2 MB JSON body.
Changing duplicate detection from name to email and merging identical rows are breaking changes recorded in the CHANGELOG.
