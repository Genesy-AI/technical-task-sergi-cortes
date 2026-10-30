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

### Provider probes (task 1.2)

Re-probed on 2026-10-30 with synthetic inputs (`john.doe@example.com`, `CTO`, `Ada Lovelace`, `example.com`), three calls each plus one missing-field and one wrong-key call.

| Provider | Status | Latency | Body |
| --- | --- | --- | --- |
| Astra Dialer | 200, 200, 200 | 0.2 s, 1.3 s, 0.2 s | `{"phoneNmbr":null}`, `{"phoneNmbr":"3857448574"}`, `{"phoneNmbr":null}` |
| Nimbus Lookup | 200, 200, 200 | 2.2 s to 2.4 s | `{"phoneNmbr":9995992355,"countryCode":"ES"}` and similar |
| Orion Connect | 500, 200, 500 | 1.5 s, 5.7 s, 0.2 s | `{"message":"Internal server error"}` or `{"phone":"6480136887"}` |

- Every provider answers 400 `{"message":"Missing required input"}` for a missing field and 401 `Unauthorized` for a wrong key.
- No provider sends rate-limit or `Retry-After` headers yet.
- Compared with the design: Astra also signals "no phone" as `{"phoneNmbr":null}`, which its normalizer already treats as not found, and Orion's slowest success (5.7 s) stays inside its 10-second attempt limit.
