# Spec Delta

## Purpose

Defines which lead fields the leads table shows, how users choose the visible columns as the field list grows, and how contact values are presented.

## ADDED Requirements

### Requirement: New fields as table columns
The leads table SHALL offer columns for phone, LinkedIn URL, years in role, and years at company, and SHALL show a dash for blank values.

#### Scenario: Imported values visible
- **WHEN** the user imports `docs/leads-ok-1.csv`
- **THEN** the table shows each lead's phone and years in role

### Requirement: Column visibility
The user SHALL be able to show and hide columns from a column menu, the choice SHALL persist across page reloads in the same browser, and the selection checkbox and name columns SHALL always be visible.

#### Scenario: Hide a column
- **WHEN** the user hides the Years at company column and reloads the page
- **THEN** the column is still hidden

#### Scenario: Default columns
- **WHEN** a user opens the table for the first time
- **THEN** name, email, phone, job title, company, country, and message are visible, and LinkedIn, years in role, years at company, and created are available in the column menu

### Requirement: Actionable contact values
A phone SHALL be shown as a `tel:` link, and a LinkedIn URL SHALL be shown as a link that opens in a new tab without giving the opened page access to the app.

#### Scenario: LinkedIn link
- **WHEN** a lead has a LinkedIn URL
- **THEN** its cell shows a link to that URL that opens in a new tab with `noopener` and `noreferrer`

### Requirement: Columns do not clip
When the visible columns are wider than the table, the table SHALL scroll horizontally with the name column kept in view, and long values SHALL be truncated with the full value available on hover.

#### Scenario: Many visible columns
- **WHEN** the user shows every column on a 1440 pixel wide window
- **THEN** no column header is cut off at the card edge, and the name column stays visible while scrolling
