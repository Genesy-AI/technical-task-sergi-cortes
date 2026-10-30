# Spec Delta

## Purpose

Defines the profile data a lead holds beyond name and email, including contact details and role history, and the rules that keep each value valid or blank.

## ADDED Requirements

### Requirement: Lead phone number
A lead SHALL have an optional phone number, stored as cleaned text with surrounding whitespace removed and an optional extension kept.
A value with fewer than 7 or more than 15 digits, ignoring punctuation and the extension, SHALL be stored blank.

#### Scenario: Formatted number
- **WHEN** a lead is imported with phone `(731)123-9702`
- **THEN** the stored phone is `(731)123-9702`

#### Scenario: Number with extension
- **WHEN** a lead is imported with phone `+1-280-754-0462x2154`
- **THEN** the stored phone is `+1-280-754-0462x2154`

#### Scenario: Too few digits
- **WHEN** a lead is imported with phone `12-34`
- **THEN** the lead is imported and its stored phone is blank

### Requirement: Lead LinkedIn profile URL
A lead SHALL have an optional LinkedIn profile URL, stored in the canonical form `https://www.linkedin.com/in/<slug>` without query string or trailing slash.
A value that is not a LinkedIn personal profile URL SHALL be stored blank.

#### Scenario: Variants of one profile
- **WHEN** a lead is imported with `linkedin.com/in/ada-lovelace/`, `http://www.linkedin.com/in/ada-lovelace?utm=x`, or `https://es.linkedin.com/in/ada-lovelace`
- **THEN** the stored URL is `https://www.linkedin.com/in/ada-lovelace`

#### Scenario: Not a profile URL
- **WHEN** a lead is imported with `https://www.linkedin.com/company/acme` or `https://example.com/in/ada`
- **THEN** the lead is imported and its stored LinkedIn URL is blank

### Requirement: Role history
A lead SHALL have an ordered list of roles, each with a job title, an optional company, and optional whole years in that role from 0 to 80.
A years value that is not a whole number in that range SHALL be stored blank.

#### Scenario: Roles in order
- **WHEN** a person is imported with rows `Engineer, 3` and then `Eng. Manager, 2`
- **THEN** the lead has two roles in that order

#### Scenario: Invalid years
- **WHEN** a role is imported with years `2.5`, `-1`, `81`, or `ten`
- **THEN** the role is stored with blank years

### Requirement: Current role
Exactly one role of a lead SHALL be current, and the lead's job title and company SHALL be those of its current role.

#### Scenario: Current role by file order
- **WHEN** a person is imported with rows for `Engineer` and then `Eng. Manager` and no row is marked current
- **THEN** the current role is `Eng. Manager` and the lead's job title is `Eng. Manager`

#### Scenario: Current role marked explicitly
- **WHEN** a person is imported with rows for `Engineer` marked current and then `Eng. Manager`
- **THEN** the current role is `Engineer`

### Requirement: Years at company
A lead's years at company SHALL be the sum of years in role over its roles at the current role's company, and SHALL be blank when none of those roles has years.

#### Scenario: Sum over roles at the same company
- **WHEN** a lead has roles at Acme with 3 and 2 years and its current role is at Acme
- **THEN** its years at company is 5

#### Scenario: Roles at another company are excluded
- **WHEN** a lead has a role at Globex with 4 years and roles at Acme with 3 and 2 years, and its current role is at Acme
- **THEN** its years at company is 5

#### Scenario: No years known
- **WHEN** none of a lead's roles at its current company has years
- **THEN** its years at company is blank

### Requirement: Profile fields in the leads API
Listing leads SHALL return each lead's phone, LinkedIn URL, roles in order, current role, years in current role, and years at company.

#### Scenario: Listing a lead with roles
- **WHEN** a client lists leads after importing a person with two roles at Acme
- **THEN** the response includes both roles, the current role's job title and company, and the summed years at company
