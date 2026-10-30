# 04 - Features

This document lists every user-facing feature and traces it end to end.
The wireframes in `docs/ui-wireframes.png` show the intended UX for the table, the Enrich menu, message generation, and CSV import.

## Feature inventory

| Feature | UI entry point | Backend | Status |
| --- | --- | --- | --- |
| List leads | Page load | `GET /leads`, `GET /leads/fields` | Working, unpaginated, with configurable columns including phone, LinkedIn, and years. |
| Select leads | Row and header checkboxes | - | Working, with indeterminate header state. |
| Delete leads | Toolbar "Delete" | `DELETE /leads` | Working, no confirmation dialog. |
| Import leads from CSV | Toolbar "Import CSV" | `POST /leads/import/preview`, `POST /leads/bulk` | Working, with people grouped by email into role histories and invalid values blanked with notes. |
| Generate messages | Enrich, then "Generate Messages" | `POST /leads/generate-messages` | Working, with every templatable field and missing-field warnings. |
| Verify emails | Enrich, then "Verify Email" | `POST /leads/verify-emails` and Temporal | Working in the background, with per-row progress and outcomes. |
| Enrich phone | Enrich, then "Enrich Phone", or Retry and Re-enrich in the row | `POST /leads/enrich-phone` and Temporal | Working in the background, trying Astra, Nimbus, and Orion in order with per-row progress. |
| Guess gender | Enrich, then "Guess Gender" | none | Placeholder toast only. |
| Create, read, update, delete one lead | No UI | `POST`, `GET`, `PATCH`, `DELETE /leads/:id` | API only, create and update contracts are broken. |

## List, select, and delete

```mermaid
sequenceDiagram
    actor U as User
    participant L as LeadsList
    participant Q as TanStack Query
    participant API as Express
    participant DB as SQLite

    U->>L: Open page
    L->>Q: useQuery(['leads','getMany'])
    Q->>API: GET /leads
    API->>DB: findMany()
    DB-->>API: all rows
    API-->>Q: Lead[]
    Q-->>L: render table
    U->>L: Select rows, click Delete
    L->>API: DELETE /leads { ids }
    API->>DB: deleteMany(id in ids)
    API-->>L: { deletedCount }
    L->>Q: invalidate ['leads','getMany']
    L-->>U: success toast, selection cleared
```

## CSV import

```mermaid
sequenceDiagram
    actor U as User
    participant M as CsvImportModal
    participant P as csvParser
    participant API as Express
    participant DB as SQLite

    U->>M: Drop or pick a .csv file
    M->>P: readCsvRows(text)
    P-->>M: raw rows, headers as written
    M->>API: POST /leads/import/preview { rows }
    API->>DB: find existing emails, ignoring case
    API-->>M: plan: people with roles, notes, invalid rows
    M-->>U: Summary (rows, leads to import, invalid, already exist) and preview per person
    U->>M: Import N leads
    M->>API: POST /leads/bulk { rows }
    API->>API: build the same plan
    loop each new person
        API->>DB: create lead with roles
    end
    API-->>M: importedCount, duplicatesSkipped, invalidRows, errors
    M-->>U: success toast, modal closes, table refetches
```

- One function builds the plan for both the preview and the import, so the preview shows exactly what will be stored ([decision 0004](../decisions/0004-backend-computes-the-import-plan.md)).
- Rows with the same email become one person with a role history; years at company sum the roles at the current company.
- The current role is the last row, unless an `isCurrentRole` column marks another.
- Invalid phone, LinkedIn, years, or country values are stored blank with a note, and countries are converted to ISO codes, so `12` becomes `DZ` and `XXX` is blank.
- Existing leads are matched by email, ignoring case, and identical rows for one person are merged with a note.
- Per-person backend errors during the write are returned but not shown to the user.

## Message generation

```mermaid
sequenceDiagram
    actor U as User
    participant M as MessageTemplateModal
    participant API as Express
    participant G as messageGenerator
    participant DB as SQLite

    U->>M: Write template, insert {field} chips
    U->>M: Generate Messages
    M->>API: POST /leads/generate-messages { leadIds, template }
    API->>DB: findMany(id in leadIds)
    loop each lead
        API->>G: generateMessageFromTemplate(template, lead)
        alt all placeholders resolved
            API->>DB: update message
        else unknown or missing field
            API->>API: collect error for lead
        end
    end
    API-->>M: generatedCount, errors[]
    alt no errors
        M-->>U: success toast, modal closes
    else some errors
        M-->>U: inline list of failed leads, "Try Again"
    end
```

- Fields come from the registry in a grouped, searchable picker, so the list scales as fields grow.
- Before generating, the composer shows how many selected leads lack each used field and flags unknown fields.
- A lead missing a used field gets no message and is listed afterwards, a product decision that differs from the wireframe's empty message.
- There is no preview of the rendered message before saving.

## Email verification

```mermaid
sequenceDiagram
    actor U as User
    participant L as LeadsList
    participant API as Express
    participant T as Temporal
    participant DB as SQLite

    U->>L: Enrich, then Verify Email
    L->>L: close the menu
    L->>API: POST /leads/verify-emails { leadIds }
    API->>DB: mark leads PENDING
    API->>T: start one verifyEmailWorkflow per lead
    API-->>L: 202 { started, failed }
    L-->>U: "Verification started for N leads", spinners per row
    T->>DB: each workflow saves VERIFIED, INVALID, or FAILED
    loop every 2 s while any lead is PENDING
        L->>API: GET /leads
    end
    L-->>U: each row shows its outcome, with Retry when it failed
```

- The request returns at once, and each lead's outcome appears on its own as soon as its workflow ends.
- A check that never answers ends as "Couldn't verify" in about 18 seconds, and the user can retry it from the row.
- Starting again while a lead is pending joins the running verification instead of starting a second one.
- This was the fix for the README's "Email verification stalls" bug, see [FIX-002](../fixes/FIX-002-email-verification-stall.md).

## Phone enrichment

```mermaid
sequenceDiagram
    actor U as User
    participant L as LeadsList
    participant API as Express
    participant T as Temporal
    participant DB as SQLite

    U->>L: Enrich, then Enrich Phone
    L->>L: close the menu
    L->>API: POST /leads/enrich-phone { leadIds }
    API->>DB: mark leads without a phone PENDING
    API->>T: start one enrichPhoneWorkflow per lead
    API-->>L: 202 { started, skipped, failed }
    L-->>U: "Phone lookup started for N leads", skipped count
    T->>DB: progress per provider, then FOUND, NOT_FOUND, or FAILED
    loop every 2 s while any lead is PENDING
        L->>API: GET /leads
    end
    L-->>U: "Trying Nimbus Lookup (2/3)", then the phone with its provider
```

- Leads that already have a phone are skipped, and the row's Re-enrich button replaces the phone only after a confirmation.
- Providers that cannot be asked are skipped with a reason: Nimbus without a job title, Orion for free email addresses.
- "No data found" and "Lookup failed" show each provider's result on hover, and a failed row has Retry.
- See [the feature document](../features/enrich-lead-phone.md) for the provider probes and end-to-end evidence.

## Features requested by the README

This table shows where each README feature fits and whether it is done.

| Feature | Touch points in the current design |
| --- | --- |
| New fields: phone number, years at company, LinkedIn URL | Done by the add-lead-fields change, see [the feature document](../features/add-lead-fields.md). |
| Enrich phone with three providers in sequence | Done by the enrich-lead-phone change, see [the feature document](../features/enrich-lead-phone.md). |
| Email verification feedback | Done by the fix-email-verification-stall change, see [FIX-002](../fixes/FIX-002-email-verification-stall.md). |
| Country code validation | Done by the fix-csv-country-codes change, see [FIX-001](../fixes/FIX-001-csv-country-codes.md). |
