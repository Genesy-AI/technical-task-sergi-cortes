# Proposal

## Why

Importing `docs/leads-with-errors.csv` shows values such as `XXX` and `12` in the Country column, because no layer validates or converts country values.
The seed database already holds a non-ISO value (`UK`), so bad data also exists outside of imports.
Leads with unusable countries break segmentation and outreach, so country values must always be valid ISO 3166-1 alpha-2 codes or blank.

## What Changes

- Every country value that reaches the bulk import endpoint is converted to an uppercase ISO 3166-1 alpha-2 code when it can be converted, and stored blank otherwise.
- Convertible inputs are alpha-2 codes in any case, alpha-3 codes, ISO numeric codes with or without leading zeros, the reserved aliases `UK` and `EL`, and English country names matched exactly after normalization.
- Ambiguous or unknown values are stored blank and never guessed, and the row is still imported.
- The CSV import preview shows the converted country per row and flags values that were converted or cleared.
- A re-runnable backfill command converts country values already stored in the database, with a dry-run mode that lists changes before writing.

## Capabilities

### New Capabilities

- `lead-country-code`: How lead country values are converted to ISO 3166-1 alpha-2 codes on import, previewed to the user, and kept valid in stored data.

### Modified Capabilities

None.

## Impact

- **Backend:** a new country conversion module, the `/leads/bulk` handler, a new endpoint that converts a list of country values for the preview, and a backfill script.
- **Frontend:** the CSV import modal shows the converted country and a per-row note.
- **Dependencies:** adds `i18n-iso-countries` to the backend.
- **Data:** the backfill changes the committed `backend/prisma/dev.db`, which today changes one row from `UK` to `GB`.
- **Tests:** introduces API-level tests for the backend, which requires exporting the Express app without starting the server or the Temporal worker.
