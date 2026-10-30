# Feature - Enrich phone

| Field | Value |
| --- | --- |
| OpenSpec change | [enrich-lead-phone](../../openspec/changes/enrich-lead-phone/proposal.md) |
| Capability | `phone-enrichment` |
| Depends on | `fix-email-verification-stall`, `add-lead-fields` |
| Status | Planned |

## Problem

Many leads have no phone, and three external providers can find one.
Lookups must try providers in sequence, stop early, stay bounded in time, run once per lead, show progress, and be ready for provider rate limits.

## Product decisions

Decided with the product owner on 2026-10-30 during exploration.

- Providers run fastest first for now: Astra Dialer, then Nimbus Lookup, then Orion Connect, with the order kept in configuration.
- Orion Connect's company website is the domain of the lead's business email, and free email addresses skip Orion.
- Leads that already have a phone are skipped, and an explicit "Re-enrich phone" action replaces the number.
- A lookup where a provider errored after its retries and none found a phone ends as "Failed", with a retry offered.

## Findings from live provider probes

Recorded on 2026-10-30 with synthetic inputs only.

- Nimbus Lookup returns `phoneNmbr` and `countryCode`, not the `number` field the README documents.
- Orion Connect takes about 4.2 seconds, and every provider returned HTTP 500 on some calls.
- No provider sends rate-limit headers yet.

## Evidence

Probe results and verification screenshots are added here during tasks 1.2, 8.1, and 8.2.
