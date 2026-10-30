# Proposal

## Why

Sales users need a lead's phone number, LinkedIn profile, and tenure to qualify and personalize outreach, and the sample CSVs already carry `phoneNumber` and `yearsInRole` columns that the import silently drops.
Every lead field is listed separately in about 11 places across both apps (finding A2), so each new field is costly and error-prone, and the README warns that the field list will keep growing.
The message composer shows a flat row of field chips that will not scale past a handful of fields.

## What Changes

- Leads gain a **phone number**, a **LinkedIn profile URL**, and a **role history**: each role has a job title, a company, and years in that role.
- **Years at company** is the sum of years in each role held at the lead's current company, calculated rather than stored.
- The **current role** is the last role for a person in file order, unless an optional `isCurrentRole` column marks another row; the lead's job title and company come from it.
- **CSV import** maps `phoneNumber`, `linkedinUrl`, `yearsInRole`, and `isCurrentRole` (with common header aliases), and groups rows that share an email address into one lead with several roles.
- **BREAKING:** import duplicate detection changes from first and last name to email address, because rows for the same person now become roles instead of duplicates, and different people can share a name.
- Invalid phone, LinkedIn, or years values are stored blank, the row is still imported, and the preview notes why, as countries already do.
- The import preview is computed by the backend for the whole file, replacing the country-only normalize endpoint.
- **BREAKING:** `POST /leads/country-codes/normalize` is replaced by `POST /leads/import/preview`.
- A single backend **lead field registry** drives the import mapping, the message template fields, and the table columns, and the frontend reads it from `GET /leads/fields`.
- The **message composer** replaces the flat chip row with a grouped, searchable field picker, and warns before generating when a field is missing for some selected leads; those leads still get no message and are listed with an error.
- The **leads table** shows the new fields with a column visibility menu, a phone `tel:` link, and a LinkedIn link.

## Capabilities

### New Capabilities

- `lead-profile`: The data a lead holds beyond identity (phone, LinkedIn URL, role history, current role, years at company) and the validation rules for each value.
- `lead-import`: How CSV rows map to leads, group into one lead per person, are validated and previewed, and are deduplicated against existing leads.
- `message-composition`: How users discover and insert fields into a message template, and how missing fields are warned about and handled when generating.
- `leads-table`: Which lead fields the table shows, how users choose visible columns, and how phone and LinkedIn values are presented.

### Modified Capabilities

None.
The `lead-country-code` requirement that the preview shows converted countries stays satisfied by the new import preview.

## Impact

- **Backend:** Prisma schema and migration (new `leadRole` table, `phone` and `linkedinUrl` columns), a field registry module, the bulk import handler, a new import preview endpoint, `GET /leads/fields`, the leads list response, and the message generator's field allow-list.
- **Frontend:** API types, the CSV parser, the import modal, the message composer, and the leads table.
- **Dependencies:** none expected.
- **Ordering:** lands after `fix-email-verification-stall`, which also changes the lead schema and the leads table, and before `enrich-lead-phone`, which writes to the phone field defined here.
