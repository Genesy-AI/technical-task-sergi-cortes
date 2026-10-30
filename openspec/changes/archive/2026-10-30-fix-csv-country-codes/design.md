# Design

## Context

See proposal.md for motivation and specs/lead-country-code/spec.md for the required behavior.

Country values flow through three layers today, and none of them checks the value.

```
CSV file --> csvParser (browser) --> POST /leads/bulk --> SQLite --> LeadsList
             any non-empty string     stored as is        shown as is
```

The sample files are valid UTF-8, so this is not an encoding problem.
The invalid values are `XXX` (four rows) and `12` (one row) in `docs/leads-with-errors.csv`, plus `UK` (one row) in the committed `dev.db`.

The backend has no API tests, and `backend/src/index.ts` starts the HTTP server and the Temporal worker on import, so route handlers cannot be tested in isolation yet.
The two packages share no code.

## Goals / Non-Goals

**Goals:**

- One conversion implementation that the import, the preview, and the backfill all use.
- Deterministic conversion with no guessing, so a blank always means "not recognized".

**Non-Goals:**

- Fuzzy matching or spelling correction of country names.
- Names in languages other than English.
- Showing full country names or flags in the leads table.
- A shared types or code package between frontend and backend.

## Decisions

### Decision 1: The backend owns conversion

The conversion lives in one pure backend module that returns the converted code plus whether the input was kept, converted, or cleared.
The bulk import handler applies it to every row before writing.

Alternative considered: convert in the browser parser only.
Rejected because any other client of `/leads/bulk` would bypass it, and the backend is the last line of defense for stored data.

### Decision 2: The preview asks the backend instead of duplicating the rules

The import modal sends the distinct country values of the parsed file to a new `POST /leads/country-codes/normalize` endpoint.
It receives one result per value and renders the converted code and a note for each row.

Alternatives considered:

- Duplicate the module in the frontend.
  Rejected because two copies of the alias and name rules would drift, and the preview would then promise something the import does not do.
- Introduce a shared workspace package.
  Rejected for this bug fix because it restructures both packages, and it is better handled as its own improvement.

The request sends only distinct values, so a file with thousands of rows usually sends fewer than a hundred strings.

### Decision 3: Use `i18n-iso-countries` with an explicit reverse name index

The library supplies alpha-3, numeric, and English name data from one maintained ISO dataset.
A probe against version 7.14.0 confirmed the following behavior, which shapes the module.

| Input | Library result | Consequence for the module |
| --- | --- | --- |
| `numericToAlpha2('12')` | `DZ` | Numeric codes are padded by the library. |
| `numericToAlpha2('999')` | `undefined` | Unassigned numbers already resolve to nothing. |
| `alpha3ToAlpha2('esp')` | `undefined` | Input must be uppercased before alpha-3 lookup. |
| `isValid('UK')` | `false` | Reserved aliases need a small explicit table. |
| `getAlpha2Code('Congo', 'en')` | `CG` | The library returns the first match, but `Congo` is also a name of `CD`. |
| `getAlpha2Code('Korea', 'en')` | `undefined` | Not every short name is listed. |

Because the library silently picks the first match for an ambiguous name, the module builds its own reverse index at startup from every English name of every country.
Each name is normalized the same way as the input, and any normalized name that maps to more than one code is marked ambiguous and resolves to blank.

Alternative considered: the browser and Node `Intl.DisplayNames` API.
Rejected because it only maps codes to names and has no alpha-3, numeric, or reverse lookup.

### Decision 4: Fixed resolution order

```
input --> trim
      --> empty?                        --> blank (kept as empty)
      --> uppercase in alias table?     --> GB or GR
      --> 2 letters, valid alpha-2?     --> uppercase code
      --> 3 letters, valid alpha-3?     --> alpha-2
      --> 1 to 3 digits, assigned?      --> alpha-2
      --> normalized name, one match?   --> alpha-2
      --> otherwise                     --> blank (cleared)
```

The branches cannot conflict, because English country names are at least four letters long and codes are at most three characters.
Name normalization applies Unicode NFD, removes combining marks, lowercases, replaces punctuation with spaces, collapses whitespace, and drops a leading "the ".

### Decision 5: Backfill as a re-runnable script with dry run by default

A Prisma migration is plain SQL and cannot call the conversion module, and a SQL mapping table would duplicate the rules.
A backend script, exposed as `pnpm db:normalize-countries`, reads every lead, applies the module, prints each planned change, and writes only with `--apply`.
A value that is already valid converts to itself, so re-running changes nothing.

### Decision 6: Make the Express app importable for tests

`backend/src/index.ts` is split so that an `app` module builds and exports the Express app, and the entry point only listens and starts the worker.
API tests then use `supertest` against the exported app with a test SQLite database.
The `fix-email-verification-stall` change needs the same split, and whichever change lands first performs it.

## Risks / Trade-offs

- [Library data updates change results] → Pin the major version and keep the scenario table from the spec as unit tests, so a data change that alters behavior fails CI.
- [Common names missing from the dataset, such as `Viet Nam`, become blank] → Accepted, because blank is the safe outcome, and new aliases can be added to the explicit table when real files show them.
- [The preview needs a network call after parsing] → Only distinct values are sent, and a failure of that call shows the raw value with a "could not check" note instead of blocking the import.
- [The backfill changes the binary `dev.db` in git] → The pull request description includes the dry-run output so reviewers can see the data change.

## Migration Plan

1. Deploy the conversion module, the import change, and the preview endpoint together.
2. Run `pnpm db:normalize-countries` in dry-run mode and review the output.
3. Run it with `--apply`.

Rollback: revert the code.
Converted values are valid codes, so they need no data rollback, and the dry-run output records the original values.
