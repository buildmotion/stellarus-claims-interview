# Reference implementation: `GET /claims/:claimId`

Source: [architecture-review.md §7](./architecture-review.md#7-reference-implementation-of-the-exercise). It also addresses review items: validation (§3.3), error strategy (§3.3), bootstrap error handling (finding #10), and the e2e `esModuleInterop` defect (finding #2).

## Behavior

| Request                                                                         | Status        | Body                                                                                | Logged          |
| ------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- | --------------- |
| `GET /claims/CLM-1001`                                                          | `200`         | The `Claim` JSON                                                                    | Nothing         |
| `GET /claims/CLM-9999` (well-formed, unknown)                                   | `404`         | `{ statusCode, message: "Claim CLM-9999 not found", error }`                        | `warn`          |
| `GET /claims/abc`, `clm-1001`, `CLM-12345678901`, oversize, injection-style ids | `400`         | `{ statusCode, message: "claimId must match the format CLM-<1-10 digits>", error }` | `warn`          |
| Repository throws                                                               | `500`         | `{ statusCode: 500, message: "Internal server error" }` (no internal details)       | `error` + stack |
| App fails to start (e.g. `EADDRINUSE`)                                          | exit code `1` | n/a                                                                                 | `error` + stack |

## Request flow

```
HTTP → ParseClaimIdPipe (400) → ClaimsController → ClaimsService (re-validates) → ClaimsRepository ← MockDataStore
                                     │ undefined → NotFoundException (404)
any escaped exception → AllExceptionsFilter → Winston (warn 4xx / error 5xx) → HTTP reply
```

## Files

| File                                                                            | Role                                                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [src/claims/claim-id.ts](../src/claims/claim-id.ts)                             | `CLAIM_ID_PATTERN` (`^CLM-\d{1,10}$`), branded `ClaimId` type, `isClaimId` type guard                             |
| [src/claims/parse-claim-id.pipe.ts](../src/claims/parse-claim-id.pipe.ts)       | Validates the route param at the HTTP boundary; `400` before any data access. Does not echo the input             |
| [src/claims/claims.repository.ts](../src/claims/claims.repository.ts)           | Port gains `findById(claimId: ClaimId): Promise<Claim \| undefined>`                                              |
| [src/claims/mock-data-store.ts](../src/claims/mock-data-store.ts)               | Exact-match lookup; returns a deep copy                                                                           |
| [src/claims/claims.service.ts](../src/claims/claims.service.ts)                 | `findById`: runtime re-check of the id, then delegates. Returns `undefined` on a miss (stays independent of HTTP) |
| [src/claims/claims.controller.ts](../src/claims/claims.controller.ts)           | `@Get(':claimId')`: maps `undefined` to `NotFoundException`                                                       |
| [src/logging/winston.config.ts](../src/logging/winston.config.ts)               | Winston options: JSON lines in production, Nest-style pretty output otherwise; validated `LOG_LEVEL`              |
| [src/logging/all-exceptions.filter.ts](../src/logging/all-exceptions.filter.ts) | Global `@Catch()` filter: logs every error, replies with Nest's default body shape, hides 5xx details             |
| [src/app.module.ts](../src/app.module.ts)                                       | Imports `WinstonModule.forRoot`, registers the filter via `APP_FILTER` (so it also applies in e2e tests)          |
| [src/main.ts](../src/main.ts)                                                   | Uses Winston as the Nest app logger; `bootstrap().catch` logs and sets exit code `1`                              |
| `tsconfig.json`                                                                 | `esModuleInterop: true` (the e2e suite failed without it: finding #2 confirmed)                                   |

New dependencies: `winston`, `nest-winston` (requested). Validation adds no dependency: a single path parameter does not justify `class-validator` / `class-transformer`. Adopt those with `ValidationPipe` once request bodies or query DTOs arrive.

## Design notes

- **Validation twice, on purpose.** The pipe is the HTTP contract (`400`). The branded `ClaimId` type means the service and repository cannot be called with a raw `string` without a visible cast. The service's runtime re-check covers casts, plain-JS callers and future non-HTTP entry points (queue consumers, jobs). Invalid input never reaches the store.
- **Strict format.** The id is not trimmed or upper-cased. Normalising input would make two different URLs return the same resource, and it hides client bugs.
- **Length bound.** `\d{1,10}` rejects oversize input in constant time, so a 5 KB id is refused before any lookup.
- **Not found vs. invalid.** A well-formed unknown id returns `404`; a malformed id returns `400`. When authorization arrives, return `404` for claims the caller may not see, as well as for missing ones (see review §6, enumeration resistance).
- **One place logs.** Controllers and services throw; only the filter logs. That avoids duplicate log lines and gives one consistent log shape: `{ message, error, statusCode, method, path, context }`.
- **Log levels.** `4xx` → `warn` (the client's fault; useful to spot abuse), `5xx` / unknown → `error` with stack.
- **No leakage.** Unexpected errors reply with a generic `500`. The real message and stack go only to the logs.
- **Route order.** Any future static route (e.g. `/claims/search`) must be declared above `@Get(':claimId')`.

### Production follow-ups (not done here)

- **PHI in logs.** The log line includes `path` and the 404 message, and both contain the claim id. Claim numbers may count as identifiers under HIPAA. Before real data arrives, log the route pattern (`/claims/:claimId`) or a hashed id, and move the id into a dedicated audit trail.
- Add a correlation/request id to every log line (e.g. via `AsyncLocalStorage`), and switch the error body to RFC 9457 `problem+json`.
- If Winston writes to a network transport (not only the console), flush it before the process exits.

## Tests

`npm test`: 81 unit tests across 7 suites. `npm run test:e2e`: 17 tests.

| Suite                           | Covers                                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claim-id.spec.ts`              | Valid ids, including the length bounds; rejects empty, case, whitespace, newline, non-ASCII digits, 11 digits, 10 KB input, SQL/path-traversal strings, non-strings (`undefined`, `null`, number, object, array, boxed `String`)                      |
| `parse-claim-id.pipe.spec.ts`   | Pass-through; `400` for bad values; error body does not echo hostile input                                                                                                                                                                            |
| `mock-data-store.spec.ts`       | Every seed id; full shape; miss; no prefix/substring match; returned claims are deep copies                                                                                                                                                           |
| `claims.service.spec.ts`        | Delegation; miss → `undefined`; invalid ids rejected **without calling the repository**; repository failure propagates unchanged                                                                                                                      |
| `claims.controller.spec.ts`     | Found; `NotFoundException` with message; repository failure propagates                                                                                                                                                                                |
| `all-exceptions.filter.spec.ts` | 4xx → `warn`; structured and string bodies; 5xx → `error` + stack; unknown `Error` hidden from the client; thrown non-Errors (string, `undefined`, object); headers already sent → logs but does not reply                                            |
| `winston.config.spec.ts`        | `LOG_LEVEL` default, normalization and invalid fallback; production output is parseable JSON with timestamp and stack; level filtering; non-production output is human-readable                                                                       |
| `test/app.e2e-spec.ts`          | `200` per seed id with exact body; `404` + `warn`; nine malformed ids → `400`, repository not called; repository failure → generic `500` + `error` log with stack; unknown route → `404` + `warn`. Uses a mocked Winston provider to assert log calls |

## Verification

Run on Node 24.21 on 2026-09-24:

```bash
npm run build && npm run lint && npm test && npm run test:e2e   # all pass
```

Manual check of the built app with `NODE_ENV=production`: `200` / `404` / `400` responses as in the table above, one JSON log line per error, and a second instance on the same port logs `Application failed to start` with the `EADDRINUSE` stack and exits `1`.

## Configuration

| Variable    | Default | Effect                                                                                                             |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `LOG_LEVEL` | `info`  | `fatal`, `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. Case-insensitive; unknown values fall back to `info` |
| `NODE_ENV`  | unset   | `production` → JSON log lines; anything else → pretty, coloured output                                             |
