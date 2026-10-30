# 05 - Code Design Assessment

This document evaluates the current design and lists concrete findings.
Each finding names the location so it can become a fix spec, a decision, or an improvement item.

## Strengths

- The scope is small and the code is easy to read end to end.
- The frontend API layer gives typed, discoverable calls through `api.leads.*`.
- TanStack Query keeps server state out of component state.
- `messageGenerator` and `csvParser` are pure functions with good unit test coverage.
- Batch endpoints report per-lead failures instead of failing the whole request.
- Temporal is already wired, so durable background work has a home.

## Defects

These are bugs that affect users or block the build.

| ID | Finding | Location | Impact |
| --- | --- | --- | --- |
| D1 | Email verification never completes for slow emails because the activity times out after one second and retries forever. | `backend/src/workflows/workflows.ts` | README bug "Email verification stalls". **Resolved** by [FIX-002](../fixes/FIX-002-email-verification-stall.md). |
| D2 | Country codes are not validated anywhere, so invalid values from CSV are stored and shown. | `frontend/src/utils/csvParser.ts`, `/leads/bulk` | README bug "CSV country codes". **Resolved** by [FIX-001](../fixes/FIX-001-csv-country-codes.md). |
| D3 | Frontend build fails with TS2741 because the optimistic lead lacks `emailVerified`. | `frontend/src/api/mutations/useApiMutation.ts` | `pnpm build` fails. **Resolved** in fix-csv-country-codes task 2.3. |
| D4 | Frontend lint fails because ESLint 9 needs a flat config. | `frontend/.eslintrc.cjs` | `pnpm lint` fails. **Resolved** in fix-csv-country-codes task 2.3. |
| D5 | `POST /leads` reads `name` while the client sends `firstName`. | `backend/src/app.ts` | Create always returns 400. |
| D6 | The client calls `PUT /leads/:id` while the server exposes `PATCH`, and the server reads `name`. | `frontend/src/api/modules/leads.ts`, `backend/src/app.ts` | Update always returns 404. |
| D7 | Duplicate rows inside one CSV are all imported. | `/leads/bulk` | Duplicate leads. |
| D8 | `GET /leads/:id` returns `null` with status 200 for a missing lead. | `backend/src/app.ts` | Wrong HTTP semantics. |
| D9 | Template values containing `$&` or `$1` are treated as replacement patterns. | `backend/src/utils/messageGenerator.ts` | Corrupted messages for some inputs. |

## Design issues

| ID | Finding | Why it matters |
| --- | --- | --- |
| A1 | All routes, validation, business rules, and persistence sit in one file. | Hard to test, review, and extend, and every feature edits the same file. |
| A2 | Lead fields are listed separately in the Prisma model, two backend modules, four frontend modules, and the table markup. | Adding a field needs many coordinated edits, which the README new-fields task exposes. |
| A3 | No shared contract or runtime validation between frontend and backend. | Contracts have already drifted, see D5, D6, and the nullable types. |
| A4 | Long-running work runs inside the HTTP request. | Requests hang, there is no progress feedback, and proxies will time out. **Resolved** for email verification by [decision 0002](../decisions/0002-start-then-observe-background-work.md). |
| A5 | Workflow IDs include a timestamp. | No idempotency, the same lead can be processed many times in parallel. **Resolved**: ids are now `verify-email-{leadId}`. |
| A6 | The Temporal worker runs inside the API process. | The API cannot start without Temporal, and the two cannot scale separately. |
| A7 | Batch operations run sequential queries without transactions. | Slow for large inputs and leaves partial writes on failure. |
| A8 | Components are large and mix data, state, and markup, and both modals duplicate the same shell logic. | Harder to test and to keep the UI consistent. |
| A9 | `useApiMutation` is unused but adds `lodash`, `ts-toolbelt`, and complex types. | Dead complexity that already broke the build. |
| A10 | Configuration is hardcoded and the SQLite database file is committed. | No environment separation and noisy diffs. |

## Security review (OWASP-oriented)

| Area | Finding |
| --- | --- |
| A01 Broken access control | No authentication or authorization on any endpoint, including bulk delete. |
| A03 Injection | Prisma parameterizes queries, so SQL injection risk is low. React escapes rendered values. |
| A04 Insecure design | No rate limiting or input size limits on bulk endpoints, which allows resource exhaustion. |
| A05 Security misconfiguration | Wildcard CORS, Devtools always rendered, `target="_blank"` without `rel`. |
| A07 Identification failures | Not applicable yet, but required before production. |
| A09 Logging failures | Only `console` logging, no request IDs or audit trail for deletes. |
| Secrets | The README places provider API keys in plain text, so new provider code must read them from environment variables. |

## Performance

- `GET /leads` returns every row with no pagination, and every mutation refetches the full list.
- Bulk import and message generation issue one query per lead.
- Email verification shares one Temporal client and starts workflows concurrently, while the table polls every two seconds only while a verification is pending.
- These are acceptable for the sample data sizes but will not hold at production volumes.

## Testability and quality gates

- Only two pure modules have tests, and there are no API, component, workflow, or end-to-end tests.
- The backend has no lint configuration.
- There is no CI pipeline to run tests, type checks, and lint on pull requests.

## Mapping to the README tasks

| README task | Related findings |
| --- | --- |
| Bug: CSV country codes | D2 |
| Bug: Email verification stalls | D1, A4, A5 |
| Feature: New lead fields | A2, A3, A8 |
| Feature: Enrich phone with Temporal | A4, A5, A6, plus secrets handling |
| PR review | A1, A3 give review criteria |
| Codebase analysis and roadmap | All findings in this document |

## Suggested direction

The following direction is a summary, not a decision.
Each item should go through its own spec and a record in `design/decisions` before implementation.

1. Restore the quality gates first by fixing D3 and D4 and adding backend lint and CI.
2. Introduce a single lead field registry with schema validation, shared by import, templates, and table columns.
3. Split the backend into routes, services, and repositories, with central error handling.
4. Move long-running work to an asynchronous start-then-observe model with deterministic workflow IDs per lead.
5. Add API and end-to-end tests around import, message generation, and enrichment flows.
