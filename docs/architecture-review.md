# Solutions Architect Review: Claims API (Stellarus take-home)

**Scope:** every file in the repository except `graphify-out/`, including the root `README.md`.
**Method:** static review of source, config, Dockerfile and lockfile metadata. **Build, tests and lint were not executed** (no Node.js on the review machine), so findings marked *unverified* are inferences from configuration.
**Context assumed:** a take-home for an architecture role at Stellarus, which is building a new healthcare platform backed by a California Blue Cross Blue Shield organization. Healthcare/HIPAA points below are framed from that context.

Companion documents: [C4 diagrams](./c4-architecture.md) · [Developer setup](./developer-setup.md)

---

## 1. Executive summary

The repository is a deliberately small NestJS 11 / TypeScript 5.9 starter: one module, one controller (`GET /claims`), one service holding three fictitious claims in memory, one unit test, one e2e test, and a multi-stage Dockerfile. It is a **coding-exercise scaffold, not a system**, and it should be judged that way: the task is to add `GET /claims/:claimId` (200/404), typed, tested.

**What is good:** idiomatic NestJS structure, strict TypeScript, a status union type instead of `string`, a clean controller/service split, correct DI, a multi-stage non-root Docker image, pinned lockfile, and no unnecessary dependencies.

**What matters most** (ranked):

| # | Finding | Severity | Type |
|---|---|---|---|
| 1 | Root README has no developer setup, no architecture, and no API contract; it mixes candidate instructions, an interview logistics link, and StackBlitz notes | High for a take-home | Documentation |
| 2 | *Unverified:* e2e test likely fails: `import request from 'supertest'` without `esModuleInterop` | High if confirmed | Test infrastructure |
| 3 | `npm run lint` cannot work: no ESLint 9 flat config and no `typescript-eslint`; script also uses `--fix` | Medium | Tooling |
| 4 | No `.gitignore` or `.dockerignore`; `dist/` and `.DS_Store` are in the tree | Medium | Repo hygiene |
| 5 | No authN/authZ, audit, or PHI controls (expected for the scaffold, essential for the platform) | Critical for production, N/A for exercise | Security |
| 6 | Money modelled as `number` (floating point) | Medium | Domain modelling |
| 7 | `findAll()` returns the internal mutable array by reference | Low | Encapsulation ([fix](./fix-07-repository-pattern.md)) |
| 8 | No persistence abstraction (service *is* the store) | Medium for evolution | Architecture |
| 9 | Dockerfile: `npm install` instead of `npm ci`, no healthcheck, no `.dockerignore` | Low–Medium | Delivery |
| 10 | `bootstrap()` has no error handling; no graceful shutdown, versioning, OpenAPI, or logging config | Low | Operability |

---

## 2. Repository inventory

| Path | Purpose | Assessment |
|---|---|---|
| `README.md` | Candidate exercise brief | Clear task, thin everything else (see §4) |
| `package.json` / `package-lock.json` | Scripts, deps | Lean; lockfile committed. See §6 |
| `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json` | Build config | `strict` on; missing `esModuleInterop` |
| `src/main.ts` | Bootstrap | Reads `PORT`; no error handling |
| `src/app.module.ts` | Composition root | Correct and minimal |
| `src/claims/claim.ts` | Domain/wire type | Good union type; `amount: number` |
| `src/claims/claims.controller.ts` | HTTP adapter | Clean; marked with the interview TODO |
| `src/claims/claims.service.ts` | Service + seed data | Marked with the interview TODO |
| `src/claims/claims.controller.spec.ts` | Unit test | Calls the controller as a method; does not exercise routing |
| `test/app.e2e-spec.ts`, `test/jest-e2e.json` | e2e test/config | Good pattern, suspected import problem |
| `Dockerfile` | Container build | Reasonable multi-stage; improvable |
| `dist/` | Build output | Should not be tracked/shipped (no `.gitignore`) |
| `docs/` | (this review) | Added |

Tests present: 1 unit + 1 e2e (both cover only `GET /claims`). Application code is about 60 lines.

---

## 3. Architecture assessment

See [c4-architecture.md](./c4-architecture.md) for all four C4 levels and sequence diagrams.

### 3.1 Current architecture

A **modular monolith in its smallest form**: one Nest module composed of a controller, a service and a type. Request flow: Express → Nest router → `ClaimsController` → `ClaimsService` → in-memory array. Stateless except for the constant seed data.

### 3.2 Strengths

1. **Separation of concerns:** HTTP concerns in the controller, data access in the service. This is the seam where the exercise change lands naturally.
2. **Constructor injection** and Nest's DI make the service trivially mockable.
3. **Strict TypeScript** (`strict`, `noImplicitAny`, `strictNullChecks`) forces honest types, which suits a `Claim | undefined` lookup.
4. **Discriminated status type** (`'PAID' | 'PENDING' | 'DENIED'`) prevents invalid states at compile time.
5. **Supply chain restraint:** five runtime dependencies, all first-party Nest plus `reflect-metadata` and `rxjs`.
6. **Container hygiene:** multi-stage, alpine, `USER node`, `NODE_ENV=production`, dev dependencies excluded from runtime.

### 3.3 Weaknesses and risks

| Area | Observation | Consequence | Recommendation |
|---|---|---|---|
| Persistence | `ClaimsService` owns the data | Swapping to a DB means rewriting the service and its tests | Introduce a `ClaimsRepository` port with in-memory and DB adapters (target in C4 L3b/L4c) |
| Encapsulation | `findAll()` returns `this.claims` directly | A caller could mutate shared state (`push`, `sort`) | Return a copy or `readonly Claim[]` |
| Domain typing | `amount: number` | Floating-point error on money (e.g. sums of 0.1 + 0.2 class problems) | Integer minor units (cents) or a decimal type; include currency |
| Contract | Domain type doubles as response type; no DTOs, no OpenAPI | Internal fields leak by default; no published contract | Response DTOs; `@nestjs/swagger`; version the API (`/v1`) |
| Errors | No error strategy | Inconsistent error bodies as the API grows | Central exception filter, RFC 9457 `application/problem+json` |
| Validation | No `ValidationPipe`; `claimId` is unvalidated | Injection/oversize inputs at scale | Validate id format (`^CLM-\d+$`) with a pipe or DTO |
| Security | No authentication, authorization, rate limiting, CORS or headers config | Any caller reads all claims (PHI-equivalent in real life) | Gateway + OIDC JWT guard, member-scoped policy, `helmet`, throttling |
| Compliance | No audit trail, no data classification | HIPAA requires access logging and minimum-necessary access | Audit interceptor, PHI-safe logging, encryption in transit and at rest |
| Operability | No health/readiness endpoint, structured logs, metrics, tracing, graceful shutdown | Cannot be run safely under an orchestrator | `@nestjs/terminus`, JSON logs, OpenTelemetry, `app.enableShutdownHooks()` |
| Bootstrap | `bootstrap()` promise is not caught | Silent unhandled rejection on startup failure | `bootstrap().catch(err => { logger.error(err); process.exit(1); })` |
| Config | `process.env` read inline | Won't scale to more settings | `@nestjs/config` with schema validation |

Most of these are **out of scope for a 15-minute exercise**. An architecture-role reviewer values *naming* them and showing judgment about what not to build.

---

## 4. README review

The root `README.md` is a solid task brief but a poor project document.

**Works well**
- The task and acceptance criteria are numbered and testable (200 on hit, 404 on miss, types, test, run build/tests).
- The AI-usage expectation and "no new dependencies unless necessary" guidance are explicit.
- Seed claim IDs are listed, so the expected data is unambiguous.

**Gaps**

| Gap | Why it matters | Suggested fix |
|---|---|---|
| No developer setup (Node version, install, run, troubleshoot) | The main complaint that prompted this review | Added: [developer-setup.md](./developer-setup.md); link it from the README |
| No Node/npm version stated | Docker uses Node 22, `@types/node` is 24; no `engines` or `.nvmrc` | Add `"engines": {"node": ">=22"}` and `.nvmrc` |
| No API contract (request/response shape, status codes, example JSON) | The exercise is an API change, and the response shape is implicit | Add an "API" section with `curl` examples and the `Claim` JSON |
| No architecture overview | An architecture role expects to see the intended structure | Link to [c4-architecture.md](./c4-architecture.md) |
| Docker usage not documented although a `Dockerfile` exists | Discoverability | Add `docker build` / `docker run` commands |
| Interview logistics inside the deliverable: private-sounding instructions ("15-minute interview"), a `<OWNER>/<REPOSITORY>` placeholder, and StackBlitz notes conditional on "after this repository is published" | Unfinished-looking; placeholders in a published repo | Remove or complete the StackBlitz URL (a concrete one can be derived from the GitHub URL already in the README) |
| Heading "GitHub Repo" is followed by a bare URL, out of order after the commands | Minor polish | Move near the top |
| Timing contradiction: "15-minute" exercise but expectations include tests, build, code review and explaining AI output | Sets a candidate up to under-deliver | State a priority order (endpoint → test → build → explanation) |
| No definition of "done" beyond the list, e.g. expected 404 body | Ambiguity in grading | Specify: Nest default 404 JSON is acceptable |

---

## 5. Quality, testing and delivery review

### 5.1 Tests

- **Unit test** (`claims.controller.spec.ts`) builds a Nest testing module and calls `controller.getClaims()` directly. Correct pattern, but it bypasses routing, so it cannot catch a wrong path or method decorator, and it will not see the HTTP status code. The new `404` behavior is only meaningfully verified at the e2e level.
- **e2e test** uses `Test.createTestingModule({ imports: [AppModule] })` and supertest, which is the right approach and needs no open port.
- **Suspected defect (unverified):** `tsconfig.json` has `allowSyntheticDefaultImports` but not `esModuleInterop`. Under `module: commonjs`, `import request from 'supertest'` compiles to `supertest_1.default(...)`, and `supertest` exports a function via `module.exports`, so `.default` is `undefined` → `TypeError: (0 , supertest_1.default) is not a function`. `ts-jest` picks up `tsconfig.json`. **Confirm by running `npm run test:e2e`.** Fix: add `"esModuleInterop": true`.
- Jest config is split between `package.json` (unit, `rootDir: src`) and `test/jest-e2e.json` (e2e, `rootDir: ..`). This is conventional Nest layout. Note `test/jest-e2e.json` lacks `.` escaping in `testRegex` (`.e2e-spec.ts$` matches any character before `e2e`; harmless here).
- `jest@30` with `ts-jest@29.4` is supported, but keep the majors aligned when upgrading.
- No coverage threshold is configured, and there is no CI to enforce anything.

### 5.2 Tooling

- `lint` script: `eslint "{src,test}/**/*.ts" --fix` with **no config file** and no `typescript-eslint`, `@eslint/js` or Prettier. ESLint 9 uses flat config only, so the command will error. It also auto-modifies files, which is surprising for a script called `lint`. Split into `lint` (check) and `lint:fix`.
- There is no formatter (Prettier), no `husky`/lint-staged, no `.editorconfig`.

### 5.3 Repo hygiene

- No `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.DS_Store` risk being committed. A `dist/` directory and a `.DS_Store` file are present in the working tree.
- No `.dockerignore`: the build context includes `node_modules`, `dist` and `.git`, so builds are slow and layer caching suffers.
- No CI configuration (GitHub Actions), and no `LICENSE`/`CODEOWNERS`. A minimal workflow (`npm ci`, build, test, e2e, `npm audit`) would be a strong, cheap signal.

### 5.4 Docker

Good: multi-stage, non-root, production env, dev deps omitted from the runtime image.
Improve:
1. Use `npm ci` (both stages) for reproducibility instead of `npm install`.
2. Add `.dockerignore`.
3. The runtime stage reinstalls dependencies; acceptable, but `npm ci --omit=dev` is deterministic.
4. Add a `HEALTHCHECK` (needs a `/health` route) or rely on orchestrator probes.
5. Pin the base image by digest for supply-chain integrity in a regulated environment.
6. Handle `SIGTERM` (`enableShutdownHooks`) so containers drain cleanly; alpine's Node as PID 1 does not forward signals well without `--init`/`tini`.

### 5.5 Dependencies

Runtime: `@nestjs/common|core|platform-express@^11.1.6`, `reflect-metadata`, `rxjs`. Dev: Nest CLI/schematics/testing, Jest 30, ts-jest, supertest, TypeScript 5.9, ESLint 9, types. Caret ranges are fine with a committed lockfile. Run `npm audit` and enable Dependabot/Renovate. `@types/node@24` while the runtime is Node 22 can allow use of APIs absent at runtime; align to `@types/node@22`.

---

## 6. Security and compliance posture (production lens)

The scaffold has no security controls; that is appropriate for the exercise. For the stated intent (a healthcare platform in the BCBS ecosystem), these are the non-negotiables to design in before any real data touches the service. Even fictitious data should be treated as PHI-shaped so the patterns are proven early.

| Control area | Minimum for a real deployment |
|---|---|
| Authentication | OIDC/OAuth2 via an enterprise IdP; short-lived JWTs validated at the gateway and in-service |
| Authorization | Object-level checks (a member sees only their claims; staff by role/purpose), prevents BOLA/IDOR on `/claims/:claimId` |
| Audit | Immutable record of every PHI read: who, what, when, why, from where |
| Data protection | TLS everywhere; encryption at rest; field-level protection for identifiers; no PHI in logs or error messages |
| Enumeration resistance | Return `404` for unauthorized IDs, and use non-sequential public identifiers |
| Transport hardening | `helmet`, strict CORS, rate limiting, request size limits |
| Supply chain | Locked dependencies, SCA scanning, image scanning, pinned base images, SBOM |
| Compliance | HIPAA Security Rule safeguards, BAAs with vendors, retention and breach-response processes; agree data-residency rules with the sponsor |

---

## 7. Reference implementation of the exercise

> **Status: implemented.** See [reference-implementation.md](./reference-implementation.md). The applied version builds on the sketch below: it validates `claimId` (`400` for malformed ids, before any data access), adds `findById` to the `ClaimsRepository` port, logs every error through Winston (`winston`, `nest-winston`: the only new dependencies) with a global exception filter, and fixes `esModuleInterop` (finding #2 confirmed). Build, lint, 81 unit tests and 17 e2e tests pass.

The minimal sketch below satisfies all six task requirements with no new dependencies.

`src/claims/claims.service.ts`
```ts
findById(claimId: string): Claim | undefined {
  return this.claims.find((claim) => claim.claimId === claimId);
}
```

`src/claims/claims.controller.ts`
```ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

@Get(':claimId')
getClaim(@Param('claimId') claimId: string): Claim {
  const claim = this.claimsService.findById(claimId);
  if (!claim) {
    throw new NotFoundException(`Claim ${claimId} not found`);
  }
  return claim;
}
```

Tests to add:
- Unit: `getClaim('CLM-1001')` returns the claim; `getClaim('CLM-9999')` throws `NotFoundException`.
- e2e: `GET /claims/CLM-1001` → `200` with `claimId: 'CLM-1001'`; `GET /claims/CLM-9999` → `404`.

Verification: `npm run build && npm test && npm run test:e2e`. The e2e suite did fail without `esModuleInterop`; the flag is now set.

Design choices worth stating in an interview: exceptions for control flow at the HTTP boundary (Nest idiom) vs. returning a result type; why `undefined` from the service rather than throwing there (keeps the service transport-agnostic); why route ordering is safe today (`@Get()` and `@Get(':claimId')` do not overlap, but a future static route such as `/claims/search` must be declared **before** the param route).

---

## 8. Evolution roadmap

| Phase | Theme | Deliverables |
|---|---|---|
| 0: Hygiene (hours) | Make the repo trustworthy | `.gitignore`, `.dockerignore`, `esModuleInterop`, working lint, `.nvmrc`/`engines`, README links, `npm ci` in Docker |
| 1: Contract | API you can integrate against | DTOs, `ValidationPipe`, OpenAPI, `/v1` prefix, problem+json errors, `/health` |
| 2: Persistence | Real data | `ClaimsRepository` port, PostgreSQL adapter, migrations, money as integer cents, Testcontainers-based integration tests |
| 3: Security | Safe for PHI | Gateway + OIDC, guards and object-level policy, audit interceptor, PHI-safe logging |
| 4: Delivery | Repeatable, observable | GitHub Actions CI/CD, image scan/SBOM, OpenTelemetry, metrics/SLOs, graceful shutdown, IaC |
| 5: Integration | Platform fit | Event-driven read model from the payer core system, EDI clearinghouse events, idempotent consumers |

### Key architectural decisions (ADR candidates)

1. **Modular monolith first, split by bounded context later.** Claims, Eligibility, Members and Providers as Nest modules with enforced boundaries; extract services only when scaling or team topology demands.
2. **Hexagonal boundaries** (ports/adapters) around persistence and external systems, so the domain is testable without infrastructure.
3. **The payer core remains the system of record;** this service serves a read model fed by events, so it is not on the adjudication critical path.
4. **API-first:** OpenAPI is the contract, with consumer-driven contract tests.
5. **Security by default:** deny-by-default guards and audit as a cross-cutting interceptor rather than per-endpoint code.

---

## 9. Open questions for the sponsor

1. Which system is the system of record for claims, and what are its integration options (REST, events, X12, FHIR)? Is FHIR (CARIN Blue Button / Da Vinci) an expected external contract?
2. Who are the API consumers (member portal, provider portal, internal tools), and what latency and availability targets apply?
3. Which compliance regimes apply beyond HIPAA (state privacy law such as CMIA/CCPA, CMS interoperability rules)?
4. What is the cloud and runtime standard (k8s, ECS, serverless) and the preferred IdP?
5. Data residency, retention, and consent requirements for claim data?
6. Is multi-tenancy across plans or lines of business expected?

---

## 10. Verdict

As an **exercise scaffold** the repository is well-chosen and idiomatic. The weaknesses that matter for the exercise itself are the unverified e2e import issue, the non-functional lint script, missing repo-hygiene files, and a README that lacks setup instructions and an API contract. As a **platform starting point** it is a healthy seed, with the standard set of production gaps (security, persistence, observability, delivery) documented above and sequenced in the roadmap. None of those gaps is a design flaw; they are things deliberately not built yet.
