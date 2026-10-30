# message-composition Specification

## Purpose

Defines how users find and insert lead fields into a message template as the field list grows, and how fields missing for some leads are surfaced before and after generating.

## Requirements

### Requirement: Every templatable lead field is available
The composer SHALL offer every lead field marked as usable in templates, including phone, LinkedIn URL, job title, years in role, and years at company, and the message generator SHALL accept exactly the same fields.

#### Scenario: New field in a template
- **WHEN** the user generates messages with the template `Call me at {phone}` for a lead with a phone
- **THEN** the message contains the lead's phone

#### Scenario: Composer and generator agree
- **WHEN** a field is added to the lead field registry as usable in templates
- **THEN** it appears in the composer and the generator accepts it without other code changes

### Requirement: Grouped and searchable field picker
The composer SHALL list fields in labeled groups and SHALL filter them by a search term matching the field label or key, and choosing a field SHALL insert `{key}` at the cursor.

#### Scenario: Search
- **WHEN** the user types `link` in the field search
- **THEN** only fields whose label or key contains `link` are listed

#### Scenario: Insert at cursor
- **WHEN** the user places the cursor after `Hi ` and chooses the First name field
- **THEN** the template reads `Hi {firstName}` and the cursor is after the inserted field

### Requirement: Missing-field warning before generating
Before generating, the composer SHALL show, for each template field missing in some selected leads, how many selected leads lack it.

#### Scenario: Field missing for some leads
- **WHEN** the template uses `{phone}` and 3 of 10 selected leads have no phone
- **THEN** the composer shows that phone is missing in 3 of 10 selected leads before the user generates

#### Scenario: Unknown field
- **WHEN** the template uses `{unknownField}`
- **THEN** the composer marks it as unknown before the user generates

### Requirement: Leads missing a field get no message
A lead missing any field used by the template SHALL get no generated message, and SHALL be listed with the missing field after generating, while other selected leads get their messages.

#### Scenario: Mixed selection
- **WHEN** the user generates `Call me at {phone}` for two leads and only one has a phone
- **THEN** one message is generated, and the other lead is listed as missing phone
