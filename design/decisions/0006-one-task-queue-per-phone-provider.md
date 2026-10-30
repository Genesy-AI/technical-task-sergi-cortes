[38;2;146;131;116m─────┬──────────────────────────────────────────────────────────────────────────[0m
     [38;2;146;131;116m│ [0m[1mSTDIN[0m
[38;2;146;131;116m─────┼──────────────────────────────────────────────────────────────────────────[0m
[38;2;146;131;116m   1[0m [38;2;146;131;116m│[0m [38;2;251;241;199m# 0006 - One Temporal task queue per phone provider[0m
[38;2;146;131;116m   2[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   3[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Status:** Accepted, extends [0002](0002-start-then-observe-background-work.md)[0m
[38;2;146;131;116m   4[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Date:** 2026-10-30[0m
[38;2;146;131;116m   5[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- **Related change:** [enrich-lead-phone](../../openspec/changes/enrich-lead-phone/design.md)[0m
[38;2;146;131;116m   6[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   7[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Decision[0m
[38;2;146;131;116m   8[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m   9[0m [38;2;146;131;116m│[0m [38;2;251;241;199m`enrichPhoneWorkflow` runs on the `phone-enrichment` task queue, and each provider's lookup activity runs on its own queue: `phone-astra`, `phone-nimbus`, and `phone-orion`.[0m
[38;2;146;131;116m  10[0m [38;2;146;131;116m│[0m [38;2;251;241;199mThe backend process starts one worker per queue, and an optional `PHONE_<PROVIDER>_MAX_PER_SECOND` sets that worker's `maxTaskQueueActivitiesPerSecond`.[0m
[38;2;146;131;116m  11[0m [38;2;146;131;116m│[0m [38;2;251;241;199mEach lookup has its own attempt time limit (5, 8, and 10 seconds) and three attempts, so a slow provider cannot hold up the others' limits.[0m
[38;2;146;131;116m  12[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  13[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Why[0m
[38;2;146;131;116m  14[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  15[0m [38;2;146;131;116m│[0m [38;2;251;241;199mProvider rate limits apply per provider across every caller, and `maxTaskQueueActivitiesPerSecond` is enforced by the Temporal server for all workers polling a queue.[0m
[38;2;146;131;116m  16[0m [38;2;146;131;116m│[0m [38;2;251;241;199mA limit on a shared queue would throttle every provider to the slowest one, and a limit per worker process would multiply with each process started.[0m
[38;2;146;131;116m  17[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  18[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Alternatives considered[0m
[38;2;146;131;116m  19[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  20[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- Worker `maxActivitiesPerSecond` on one shared queue was rejected, because it limits each worker process, not each provider.[0m
[38;2;146;131;116m  21[0m [38;2;146;131;116m│[0m [38;2;251;241;199m- A token bucket stored in the database was rejected, because Temporal already provides server-side task queue limits.[0m
[38;2;146;131;116m  22[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  23[0m [38;2;146;131;116m│[0m [38;2;251;241;199m## Consequences[0m
[38;2;146;131;116m  24[0m [38;2;146;131;116m│[0m 
[38;2;146;131;116m  25[0m [38;2;146;131;116m│[0m [38;2;251;241;199mEach provider adds a worker and a task queue to operate.[0m
[38;2;146;131;116m  26[0m [38;2;146;131;116m│[0m [38;2;251;241;199mChanging a provider's limit means restarting the workers with the new variable, and the last started worker's value wins on the server.[0m
[38;2;146;131;116m─────┴──────────────────────────────────────────────────────────────────────────[0m
