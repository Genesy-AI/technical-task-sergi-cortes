# 0003 - Lead fields are declared once in a backend registry

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related change:** [add-lead-fields](../../openspec/changes/add-lead-fields/design.md)
- **Related feature:** [New lead fields](../features/add-lead-fields.md)

## Decision

Every lead field is declared once in `backend/src/leads/leadFields.ts` with its label, group, type, CSV header aliases, whether templates may use it, its default table column state, and its normalization rule.
The import mapping, the message generator's allowed fields, and `GET /leads/fields` derive from it.
The frontend renders the table's columns, the column menu, and the composer's field picker from `GET /leads/fields`.

## Why

Before this, one field was listed in about 11 places across both apps (finding A2), and those lists had already drifted.
The README says the field list will keep growing, so adding a field must stay cheap and safe.
With the registry, a new field means one registry entry, a schema column, and at most one cell renderer for a new type.

## Alternatives considered

- Duplicated constants in both apps with a test that compares them were rejected, because they keep the duplication in a smaller form.
- A shared workspace package was rejected for this change, because it restructures both packages' builds and deserves its own decision.

## Consequences

Frontend TypeScript types for lead fields are still hand-written, so they can drift from the registry; a shared package or generated types would close that gap.
