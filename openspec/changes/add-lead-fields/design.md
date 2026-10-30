# Design

## Context

See proposal.md for motivation and the four delta specs for the required behavior.

- Lead fields are enumerated in about 11 places across 9 files (finding A2 in `design/architecture/05-assessment.md`): the Prisma model, the message generator's interface and allow-list, the bulk import mapping, four frontend type files, the CSV parser, the import modal, the composer, and the table.
- The CSV parser runs in the browser, while country conversion already runs in the backend with a preview endpoint ([decision 0001](../../../design/decisions/0001-backend-owns-country-code-conversion.md)).
- The bulk import detects duplicates by first and last name, and does not deduplicate rows within one file (finding D7).
- All sample CSVs share the header `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber`, with no LinkedIn column.
- Sample phones use mixed formats with extensions, such as `(731)123-9702` and `+1-280-754-0462x2154`, and look like US numbers even when the country is elsewhere.
- `fix-email-verification-stall` changes the lead schema and the email cell of the table, and must merge first.

## Goals / Non-Goals

**Goals:**

- Adding a future lead field touches the registry, the schema, and at most one renderer, instead of 11 places.
- One set of import rules, run in the backend, used by both the preview and the import.

**Non-Goals:**

- Editing leads or roles by hand in the UI.
- Normalizing phones to E.164 at import, which `enrich-lead-phone` handles for numbers it finds.
- Template fallbacks such as `{phone|n/a}`, autocomplete in the textarea, or a rendered preview per lead.
- Deduplicating against existing leads by anything other than email.

## Decisions

### Decision 1: Role history in its own table

```
lead 1 --- * leadRole
  id                  id
  firstName           leadId (cascade delete)
  lastName            position      (file order, 0-based)
  email               jobTitle
  phone?              companyName?
  linkedinUrl?        yearsInRole?  (0..80)
  countryCode?        isCurrent
  jobTitle?    <- copy of current role
  companyName? <- copy of current role
  ...
```

`lead.jobTitle` and `lead.companyName` stay as copies of the current role, written in the same transaction, so existing reads (messages, the table, and the Nimbus provider in `enrich-lead-phone`) keep working unchanged.
Years at company is calculated when leads are read, not stored, so it can never disagree with the roles.

Alternative considered: two plain columns `yearsInRole` and `yearsAtCompany`.
Rejected by product decision, because the sum would never be checked against the roles.

### Decision 2: A backend lead field registry

`backend/src/leads/leadFields.ts` declares each field once:

| Property | Use |
| --- | --- |
| `key`, `label`, `group` | Template key, picker label, picker group (Person, Contact, Company, Role) |
| `csvHeaders` | Accepted CSV header names, compared after lowercasing and removing non-letters |
| `templatable` | Whether the composer offers it and the generator accepts it |
| `column` | Table column default (`visible`, `available`, or none) |
| `normalize` | The validation and conversion function, such as `normalizeCountryCode` |

The import mapping, the generator's allow-list, and `GET /leads/fields` all derive from it.
The frontend renders the picker and the table's column menu from `GET /leads/fields`, and keeps one renderer per field type for cells.

Alternatives considered:

- Duplicated constants in both apps with a test that compares them, rejected because it is the same duplication in a smaller form.
- A shared workspace package, rejected for this change because it restructures both packages' builds, and it is better as its own improvement.

### Decision 3: The backend computes the whole import preview

The modal parses the file with PapaParse into raw rows and sends them to `POST /leads/import/preview`.
The backend maps headers, groups rows by email, validates every value through the registry, and returns the resulting leads with roles and notes.
`POST /leads/bulk` accepts the same raw rows and runs the same function before writing, so the preview and the import cannot disagree.
The country-only `POST /leads/country-codes/normalize` endpoint is removed, because the new preview covers it.

Alternative considered: keep grouping and validation in the browser parser.
Rejected because the grouping and role rules would then exist twice, which is the problem decision 0001 solved for countries.

### Decision 4: Grouping and duplicate detection by email

Rows group by email after trimming and lowercasing, and an existing lead with the same email makes the row a duplicate.
Within a person, the current role is the last row marked by `isCurrentRole`, or else the last row in file order.
Person-level values take the first non-blank value across the person's rows, with a preview note when rows disagree.

### Decision 5: Value rules

| Field | Rule | Invalid example becomes blank |
| --- | --- | --- |
| Phone | Trim, keep text, allow an `x` extension, require 7 to 15 digits excluding the extension | `12-34` |
| LinkedIn | Add `https://`, accept `linkedin.com` and any `*.linkedin.com` host, require `/in/<slug>`, drop query and trailing slash, rewrite host to `www.linkedin.com` | `https://example.com/in/ada` |
| Years in role | Whole number from 0 to 80 | `2.5`, `ten` |

### Decision 6: Composer and generator

The generator reads its allow-list from the registry, and keeps today's behavior of skipping a lead with a missing field and reporting it.
Before generating, the composer parses the template and counts, from the already loaded leads, how many selected leads lack each used field.
The picker is a grouped list with a search box above the textarea, replacing the chip row.

### Decision 7: Table columns

A column menu lists registry columns, persists the visible set in `localStorage` under one versioned key, and falls back to the registry defaults when storage is unavailable.
The checkbox and name columns are sticky on horizontal scroll, and long cells use `truncate` with a `title`.

## Risks / Trade-offs

- [Changing duplicate detection from name to email surprises users who relied on name matching] → The preview shows every duplicate with its reason, and the CHANGELOG marks the change as breaking.
- [Rows for one email with different names] → The first non-blank name wins and the preview notes the conflict.
- [The preview request is larger than the old country request] → Files are small in this product, and the request is limited to 5000 rows and the Express JSON body limit is raised to 2 MB to match `MAX_UPLOAD_FILE_SIZE`.
- [Merge conflicts with the email change in the schema and the table] → This change starts after `fix-email-verification-stall` merges, and its migration is created on top of that one.
- [The committed `dev.db` changes again] → The migration adds columns and a table without rewriting existing rows.

## Migration Plan

1. Merge `fix-email-verification-stall`.
2. Apply the migration, which adds `phone` and `linkedinUrl` to `lead`, creates `leadRole`, and creates one current role per existing lead from its `jobTitle` and `companyName`.
3. Deploy the backend and frontend together, because the import endpoints change.

Rollback: revert the code and restore the pre-migration database file.
