# Spec Delta

## Purpose

Defines how a CSV file becomes leads: which columns are recognized, how rows for one person combine into a lead with a role history, how values are validated and previewed, and how existing leads are detected.

## ADDED Requirements

### Requirement: Recognized CSV columns
The import SHALL recognize the columns `phoneNumber`, `linkedinUrl`, `yearsInRole`, and `isCurrentRole` in addition to the existing ones, ignoring case, spaces, and punctuation in headers, and SHALL accept the aliases `phone` for phone and `linkedin` or `linkedinProfile` for the LinkedIn URL.
Unrecognized columns SHALL be ignored.

#### Scenario: Sample file columns
- **WHEN** the user imports `docs/leads-ok-1.csv`, whose headers include `yearsInRole` and `phoneNumber`
- **THEN** the imported leads have phone numbers and roles with years

#### Scenario: Header variants
- **WHEN** a file uses the headers `Phone`, `LinkedIn Profile`, and `Years In Role`
- **THEN** the values are imported as phone, LinkedIn URL, and years in role

### Requirement: Rows for one person become one lead
Rows with the same email address, ignoring case and surrounding whitespace, SHALL be imported as one lead whose roles follow the rows' file order.

#### Scenario: Two roles for one person
- **WHEN** a file has two rows for `ada@acme.com` with job titles `Engineer` and `Eng. Manager`
- **THEN** one lead is imported with two roles

#### Scenario: Different people with the same name
- **WHEN** a file has two rows named `Curtis Monson` with different email addresses
- **THEN** two leads are imported

### Requirement: Current role column
A row whose `isCurrentRole` value is `true`, `yes`, `1`, or `x`, ignoring case, SHALL be the current role for its person.
When several rows of one person are marked, the last marked row SHALL be current, and the preview SHALL note the conflict.

#### Scenario: Marked row
- **WHEN** a person's first row has `isCurrentRole` set to `yes`
- **THEN** that row's role is current

#### Scenario: Several rows marked
- **WHEN** two rows of one person have `isCurrentRole` set to `true`
- **THEN** the later row's role is current and the preview notes that several rows were marked

### Requirement: Person-level values across rows
For values that belong to the person (names, phone, LinkedIn URL, country), the import SHALL use the first non-blank value among the person's rows, and the preview SHALL note when rows disagree.

#### Scenario: Conflicting phones
- **WHEN** two rows of one person have phones `555-0100-123` and `555-0199-456`
- **THEN** the lead's phone is `555-0100-123` and the preview notes the conflict

### Requirement: Invalid values do not block a row
A row SHALL still be imported when its phone, LinkedIn URL, or years value is invalid; the value SHALL be stored blank and the preview SHALL note why.

#### Scenario: Invalid LinkedIn URL
- **WHEN** a row has LinkedIn URL `https://example.com/in/ada`
- **THEN** the row is imported, the URL is blank, and the preview notes that it is not a LinkedIn profile URL

### Requirement: Backend-computed preview
Before importing, the user SHALL see a preview computed by the same rules as the import, showing for each resulting lead its values, its roles, and every note about converted, cleared, or conflicting values.

#### Scenario: Preview matches the import
- **WHEN** the user previews a file and then imports it
- **THEN** every stored lead equals its previewed values

#### Scenario: Grouped person in the preview
- **WHEN** the user previews a file with two rows for `ada@acme.com`
- **THEN** the preview shows one lead with two roles and its years at company

### Requirement: Existing leads are detected by email
A file row whose email matches an existing lead, ignoring case, SHALL be skipped and counted as a duplicate.

#### Scenario: Same email already stored
- **WHEN** the user imports a row for `ada@acme.com` and a lead with `ADA@acme.com` exists
- **THEN** the row is skipped and reported as a duplicate

#### Scenario: Same name, new email
- **WHEN** the user imports a row named `Ada Lovelace` with an email no lead has
- **THEN** a new lead is imported even if another lead is named `Ada Lovelace`
