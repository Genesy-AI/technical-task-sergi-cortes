# lead-country-code Specification

## Purpose

Guarantees that every stored lead country is either a valid uppercase ISO 3166-1 alpha-2 code or blank, by converting recognizable inputs and clearing everything else.

## Requirements

### Requirement: Convert recognizable country values to ISO alpha-2
The system SHALL store an imported lead's country as the uppercase ISO 3166-1 alpha-2 code that the input unambiguously identifies.
Leading and trailing whitespace SHALL be ignored.

#### Scenario: Alpha-2 code in any case
- **WHEN** a lead is imported with country `es`, `Es`, or ` ES `
- **THEN** the stored country is `ES`

#### Scenario: Alpha-3 code
- **WHEN** a lead is imported with country `ESP` or `esp`
- **THEN** the stored country is `ES`

#### Scenario: Numeric code with or without leading zeros
- **WHEN** a lead is imported with country `12` or `012`
- **THEN** the stored country is `DZ`

#### Scenario: Reserved aliases
- **WHEN** a lead is imported with country `UK` or `EL`
- **THEN** the stored country is `GB` or `GR` respectively

### Requirement: Convert English country names
The system SHALL convert an English country name to its alpha-2 code when, after ignoring case, accents, punctuation, extra spaces, and a leading "the", it matches exactly one country's official or common English name.

#### Scenario: Name in any case
- **WHEN** a lead is imported with country `Spain` or `SPAIN`
- **THEN** the stored country is `ES`

#### Scenario: Common alternative name
- **WHEN** a lead is imported with country `United States` or `United States of America`
- **THEN** the stored country is `US`

#### Scenario: Leading article and accents
- **WHEN** a lead is imported with country `The Netherlands` or `Côte d'Ivoire`
- **THEN** the stored country is `NL` or `CI` respectively

### Requirement: Store unconvertible country values as blank
The system SHALL store the country as blank when the input does not identify exactly one country, and SHALL still import the lead.

#### Scenario: Placeholder code
- **WHEN** a lead is imported with country `XXX`
- **THEN** the lead is imported and its stored country is blank

#### Scenario: Unassigned or malformed number
- **WHEN** a lead is imported with country `999`, `0`, or `12.5`
- **THEN** the lead is imported and its stored country is blank

#### Scenario: Ambiguous name
- **WHEN** a lead is imported with country `Congo` or `Korea`
- **THEN** the lead is imported and its stored country is blank

#### Scenario: Misspelled name
- **WHEN** a lead is imported with country `Spian`
- **THEN** the lead is imported and its stored country is blank

#### Scenario: Sample file with invalid countries
- **WHEN** the user imports `docs/leads-with-errors.csv`
- **THEN** no lead in the table shows `XXX` or `12` as its country

### Requirement: Preview converted countries before import
The CSV import preview SHALL show, for each row, the country that will be stored, and SHALL indicate when the original value was converted or cleared.

#### Scenario: Converted value in preview
- **WHEN** the user loads a CSV row with country `ESP` into the import modal
- **THEN** the preview shows `ES` for that row and notes that `ESP` was converted

#### Scenario: Cleared value in preview
- **WHEN** the user loads a CSV row with country `XXX` into the import modal
- **THEN** the preview shows a blank country for that row, notes that `XXX` was not recognized, and still counts the row as valid

### Requirement: Normalize stored country values on demand
The system SHALL provide an operator command that converts country values already stored, using the same rules as import.
The command SHALL default to a dry run that lists planned changes without writing, and SHALL make no changes when run again after applying.

#### Scenario: Dry run lists changes without writing
- **WHEN** an operator runs the command in dry-run mode against a database containing country `UK`
- **THEN** the output lists the change from `UK` to `GB` and the stored value is still `UK`

#### Scenario: Apply converts stored values
- **WHEN** an operator runs the command in apply mode against a database containing countries `UK` and `XXX`
- **THEN** the stored values become `GB` and blank

#### Scenario: Re-running is a no-op
- **WHEN** an operator runs the command in apply mode a second time
- **THEN** the output reports zero changes
