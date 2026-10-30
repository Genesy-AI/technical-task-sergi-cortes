# IMPROVEMENTS

These are the ten improvements with the most value after the README tasks, ranked by risk.

| #   | Improvement                                                     | Area                   | Priority |
| --- | --------------------------------------------------------------- | ---------------------- | -------- |
| 1   | Patch vulnerable dependencies                                   | Security               | Critical |
| 2   | Authenticate and authorize every endpoint                       | Security               | Critical |
| 3   | Restrict CORS and add security headers                          | Security               | High     |
| 4   | Limit request rates and sizes, especially paid provider calls   | Security, cost         | High     |
| 5   | Stop returning internal errors and add structured, audited logs | Security               | High     |
| 6   | Run the quality gates in CI                                     | Quality                | High     |
| 7   | Paginate leads and poll only what changes                       | Performance            | Medium   |
| 8   | Enforce unique emails and index what is queried                 | Performance, integrity | Medium   |
| 9   | Generate messages in one bounded transaction                    | Performance, integrity | Medium   |
| 10  | Run the Temporal workers in their own process                   | Reliability            | Medium   |

## 1. Patch vulnerable dependencies

GitHub reports 75 open Dependabot alerts on `main`: 7 critical, 27 high, 31 moderate, and 10 low.
The ones that reach production come first: `proxy-addr` (critical) and `body-parser` and `qs`, which Express uses on every request, and `@grpc/grpc-js`, which carries every Temporal call.
The other critical alerts are in `vitest` and `tinypool`, which only run in development and tests, but they still run on developer machines and future CI runners.
Most fixes are patch or minor upgrades in the lockfiles, and four Dependabot branches already propose some of them.

## 2. Authenticate and authorize every endpoint

No endpoint checks who is calling, including `DELETE /leads`, the CSV import, and the phone lookup that spends paid provider calls (finding A01).
Anyone who can reach port 4000 can read every lead's email and phone, delete all leads, or run lookups.
Add session or token authentication in one middleware, and an ownership or role check per route, before the API is exposed beyond a developer machine.

## 3. Restrict CORS and add security headers

The API answers every origin with `Access-Control-Allow-Origin: *` (finding A05), so any website a user visits can call it from their browser.
Allow only the configured frontend origin, read from the environment, and add standard headers such as `X-Content-Type-Options`, `Referrer-Policy`, and a content security policy, for example with `helmet`.
This is cheap, and it limits the damage until authentication exists.

## 4. Limit request rates and sizes, especially paid provider calls

There is no rate limiting (finding A04), so one client can start lookups for 500 leads per request, as often as it likes, and use up the providers' quota and budget.
`POST /leads/generate-messages` accepts any number of lead ids, while the other batch endpoints are capped at 500 ids or 5000 rows.
Add per-client rate limits, a cap on every batch endpoint, and a daily budget per provider that the phone workers respect, so a mistake or abuse cannot run up cost.

## 5. Stop returning internal errors and add structured, audited logs

The start endpoints return the raw error text of a failed workflow start in `failed[].error`, and message generation returns each exception's message, which can expose infrastructure details to clients.
Return a stable error code per failure, and keep the detail in the logs.
Logging is `console` only (finding A09): use a structured logger with a request id on every line, keep emails and phones out of the logs, and record who deleted or re-enriched which leads.

## 6. Run the quality gates in CI

The repository has no CI, so tests, type checks, lint, builds, and `openspec validate` only run when someone remembers to run them locally.
A GitHub Actions workflow per package should run them on every pull request, together with `pnpm audit` for production dependencies, and block merging when they fail.
It would also have caught the vulnerable dependencies in item 1 as they were introduced.

## 7. Paginate leads and poll only what changes

`GET /leads` returns every lead with its roles in one response, and the table refetches all of it every two seconds while any email check or phone lookup is pending.
With thousands of leads, each poll transfers and renders the whole table to update a few rows.
Paginate and sort on the server, and poll a small endpoint that returns only the pending leads' status, or push updates over server-sent events.

## 8. Enforce unique emails and index what is queried

Imports find existing leads with `lower("email") IN (...)`, which scans the whole table because no index exists, and nothing in the database stops two concurrent imports from creating the same email twice.
Add a unique index on the lowercased email, and indexes on `emailVerificationStatus` and `phoneEnrichmentStatus` for the pending queries in item 7.
SQLite allows one writer at a time while the API, the email verification worker, and the phone enrichment worker all write, so plan a move to PostgreSQL before real traffic (finding A10).

## 9. Generate messages in one bounded transaction

Message generation updates leads one at a time in a loop, without a transaction (finding A7), so 500 leads take 500 sequential writes, and a failure halfway leaves some leads with the new message and others with the old one.
Render all messages first, then write them in one transaction, and cap the number of leads per request as in item 4.

## 10. Run the Temporal workers in their own process

The email and phone workers run inside the API process (finding A6), so a busy provider queue competes with HTTP requests for the same event loop, and neither can be scaled or restarted alone.
There is also no shutdown handling: stopping the process drops in-flight activities instead of letting them finish.
Start the workers from their own entry point, handle `SIGTERM` by shutting the workers down gracefully, and give both processes a health check.
