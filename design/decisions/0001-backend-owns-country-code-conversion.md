# 0001 - The backend owns country code conversion

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related change:** [fix-csv-country-codes](../../openspec/changes/fix-csv-country-codes/design.md)
- **Related fix:** [FIX-001](../fixes/FIX-001-csv-country-codes.md)

## Decision

Lead country values are converted to ISO 3166-1 alpha-2 codes by a single backend module, used by the bulk import, the backfill command, and a `POST /leads/country-codes/normalize` endpoint.
The CSV import preview calls that endpoint with the file's distinct values instead of applying its own rules.

## Why

The backend is the last line of defense for stored data, so it must convert regardless of which client sends leads.
A second copy of the rules in the frontend would drift, and the preview would then promise values the import does not store.
Sending only distinct values keeps the preview request small even for large files.

## Alternatives considered

- Converting only in the browser parser was rejected, because other clients would bypass it.
- A shared workspace package for both apps was rejected for this fix, because it restructures both packages and deserves its own change.
