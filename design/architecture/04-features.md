# 04 - Features

This document lists every user-facing feature and traces it end to end.
The wireframes in `docs/ui-wireframes.png` show the intended UX for the table, the Enrich menu, message generation, and CSV import.

## Feature inventory

| Feature | UI entry point | Backend | Status |
| --- | --- | --- | --- |
| List leads | Page load | `GET /leads` | Working, unpaginated. |
| Select leads | Row and header checkboxes | - | Working, with indeterminate header state. |
| Delete leads | Toolbar "Delete" | `DELETE /leads` | Working, no confirmation dialog. |
| Import leads from CSV | Toolbar "Import CSV" | `POST /leads/bulk` | Working, with the country code defect. |
| Generate messages | Enrich, then "Generate Messages" | `POST /leads/generate-messages` | Working. |
| Verify emails | Enrich, then "Verify Email" | `POST /leads/verify-emails` and Temporal | Hangs for some leads. |
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
    M->>P: parseCsv(text)
    P-->>M: CsvLead[] with isValid and errors
    M-->>U: Summary (total, valid, invalid, duplicates) and preview table
    U->>M: Import N valid leads
    M->>API: POST /leads/bulk { leads: valid rows }
    API->>API: Re-validate required fields
    API->>DB: Find existing by firstName + lastName
    loop each new lead
        API->>DB: create
    end
    API-->>M: importedCount, duplicatesSkipped, invalidLeads, errors
    M-->>U: success toast, modal closes, table refetches
```

- Validation runs twice, in the browser for preview and in the backend for safety, with different rules.
- The browser validates email format, while the backend only checks that email is a non-empty string.
- Neither side validates `countryCode`, which is the cause of the "CSV country codes" bug in the README.
- The sample `docs/leads-with-errors.csv` contains country values `XXX` and `12`, and they are imported and displayed as is.
- Per-row backend errors are returned but not shown to the user.

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

- Insertable fields are a hardcoded list of six chips, which will not scale as fields grow.
- The wireframe expects missing fields to produce an empty message with a warning, while the code skips the lead and reports an error.
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
    L->>API: POST /leads/verify-emails { leadIds }
    loop each lead, sequentially
        API->>T: execute verifyEmailWorkflow(email)
        Note over T: Activity timeout 1s, unlimited retries.<br/>jane.smith sleeps 20s and never succeeds.
        T-->>API: boolean
        API->>DB: update emailVerified
    end
    API-->>L: verifiedCount, results, errors
    L-->>U: toast, table refetches
```

- The HTTP request stays open until every workflow finishes.
- When any selected lead hits the slow path, the request never returns and the UI shows no progress.
- The menu stays open during the request and the button has no pending state.

## Features requested by the README

These features are not implemented yet and are listed here to show where they fit.

| Feature | Touch points in the current design |
| --- | --- |
| New fields: phone number, years at company, LinkedIn URL | Prisma model and migration, bulk import mapping, `messageGenerator` allow-list and `Lead` type, frontend types, `csvParser` switch, `CsvImportModal` mapping and help text, `MessageTemplateModal` field list, `LeadsList` columns. |
| Enrich phone with three providers in sequence | New Temporal workflow and provider activities, a provider abstraction, a workflow ID per lead for idempotency, an asynchronous start endpoint, a status representation on the lead, and progress feedback in the table. |
| Email verification feedback | Activity timeout and retry policy, asynchronous start with status polling or streaming, per-lead pending state in the UI. |
| Country code validation | Shared validation rule for ISO 3166-1 alpha-2 in the CSV parser and the bulk endpoint. |
