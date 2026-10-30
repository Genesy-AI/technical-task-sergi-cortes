[38;2;146;131;116m─────┬──────────────────────────────────────────────────────────────────────────[0m
     [38;2;146;131;116m│ [0m[1mSTDIN[0m
[38;2;146;131;116m─────┼──────────────────────────────────────────────────────────────────────────[0m
[38;2;146;131;116m   1[0m [38;2;146;131;116m│[0m [38;2;251;241;199m# 0005 - Phone providers share one skip, call, and normalize abstraction[0m
[38;2;146;131;116m   2[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   3[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Status:** Accepted[0m
[38;2;146;131;116m   4[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Date:** 2026-10-30[0m
[38;2;146;131;116m   5[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Related change:** [enrich-lead-phone](../../openspec/changes/enrich-lead-phone/design.md)[0m
[38;2;146;131;116m   6[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   7[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Decision[0m
[38;2;146;131;116m   8[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   9[0m [38;2;146;131;116m│[0m [38;2;251;241;199mEach phone provider in `backend/src/phoneEnrichment/providers` implements one `PhoneProvider` contract.[0m
[38;2;146;131;116m  10[0m [38;2;146;131;116m│[0m [38;2;251;241;199m`inputFrom(lead)` builds the provider's request or returns a skip reason, `call` performs the HTTP request with the configured key, and `normalize` turns the raw answer into a phone or "not found".[0m
[38;2;146;131;116m  11[0m [38;2;146;131;116m│[0m [38;2;251;241;199m`backend/src/phoneEnrichment/catalog.ts` lists the providers with their labels, task queues, and attempt time limits, and `PHONE_PROVIDER_ORDER` chooses which run and in which order.[0m
[38;2;146;131;116m  12[0m [38;2;146;131;116m│[0m [38;2;251;241;199mHTTP status handling lives once in `lookup.ts`: 400, 401, and 403 fail without retry, a 429 retries after its `Retry-After`, and server errors, network errors, and timeouts are retried.[0m
[38;2;146;131;116m  13[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  14[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Why[0m
[38;2;146;131;116m  15[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  16[0m [38;2;146;131;116m│[0m [38;2;251;241;199mThe three providers differ only in their inputs, their answer shapes, and when they cannot be asked.[0m
[38;2;146;131;116m  17[0m [38;2;146;131;116m│[0m [38;2;251;241;199mKeeping those differences behind one contract lets the workflow loop over providers without knowing any of them, and records every skip, miss, and error in the same attempts format the table shows.[0m
[38;2;146;131;116m  18[0m [38;2;146;131;116m│[0m [38;2;251;241;199mAdding a provider is a new module and a catalog entry, with no workflow change.[0m
[38;2;146;131;116m  19[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  20[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Alternatives considered[0m
[38;2;146;131;116m  21[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  22[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- One activity per provider with its own error handling was rejected, because retry and status rules would be repeated three times and drift.[0m
[38;2;146;131;116m  23[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- A hand-written list of free email domains for Orion's skip rule was rejected in favor of the maintained `free-email-domains` package.[0m
[38;2;146;131;116m  24[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  25[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Consequences[0m
[38;2;146;131;116m  26[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  27[0m [38;2;146;131;116m│[0m [38;2;251;241;199mProvider answers that do not fit `normalize`, such as Nimbus sending the number as a JSON number, are handled in that provider's module, and the raw value is kept in the attempts record for diagnosis.[0m
[38;2;146;131;116m─────┴──────────────────────────────────────────────────────────────────────────[0m
