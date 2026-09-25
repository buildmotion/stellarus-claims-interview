# C4 Architecture Diagrams

C4 levels 1–4 for the Claims API, plus sequence diagrams. Diagrams are Mermaid and render on GitHub, GitLab, and in VS Code (Markdown Preview Mermaid Support extension).

Each level shows the **as-is** system (what is in the repository) and, where useful, the **target** state (what a production healthcare platform would need). Target elements are labelled *(target)* and are **proposals, not existing code**.

> Context assumption (from the exercise brief): Stellarus is building a new healthcare platform backed by a California Blue Cross Blue Shield organization. Actors and external systems below (members, providers, payer core systems) are illustrative assumptions, not facts about Stellarus's actual landscape.

---

## Level 1: System Context

### 1a. As-is

```mermaid
C4Context
  title System Context: Claims API (as-is)

  Person(dev, "Candidate / Interviewer", "Runs and extends the service during the exercise")
  System(claimsApi, "Claims API", "NestJS service exposing read access to a hard-coded set of fictitious claims")

  Rel(dev, claimsApi, "GET /claims", "HTTP/JSON")
```

### 1b. Target platform context (illustrative)

```mermaid
C4Context
  title System Context: Claims capability in a healthcare platform (target)

  Person(member, "Member", "Health plan member checking claim status")
  Person(provider, "Provider / Billing office", "Submits and tracks claims")
  Person(csr, "Claims analyst / Care advocate", "Investigates and adjudicates")

  System(claimsApi, "Claims API", "Read/write access to claims; enforces authorization and audit")
  System_Ext(idp, "Identity Provider", "OIDC / OAuth2 (SSO, MFA)")
  System_Ext(core, "Payer core admin system", "Adjudication, eligibility, benefits (system of record)")
  System_Ext(edi, "EDI clearinghouse", "X12 837/835/277 exchange with providers")
  System_Ext(obs, "Observability and audit platform", "Logs, metrics, traces, immutable audit trail")

  Rel(member, claimsApi, "Views own claims", "HTTPS")
  Rel(provider, claimsApi, "Checks claim status", "HTTPS")
  Rel(csr, claimsApi, "Searches and reviews claims", "HTTPS")
  Rel(claimsApi, idp, "Validates tokens", "OIDC")
  Rel(claimsApi, core, "Reads claims", "REST / events")
  Rel(edi, claimsApi, "Delivers claim events", "Events")
  Rel(claimsApi, obs, "Emits telemetry and audit events", "OTLP")
```

---

## Level 2: Containers

### 2a. As-is

A single deployable process; no database, cache, queue, or gateway.

```mermaid
C4Container
  title Container Diagram: Claims API (as-is)

  Person(client, "API client", "curl, browser, test runner")

  System_Boundary(sys, "Claims API") {
    Container(app, "NestJS application", "Node.js 22, NestJS 11, Express 5 adapter", "Serves GET /claims on port 3000 (PORT env). Holds claim data in process memory.")
  }

  Rel(client, app, "GET /claims", "HTTP/JSON")
```

Packaging: the `Dockerfile` builds an image (`node:22-alpine`, multi-stage, non-root `node` user, `EXPOSE 3000`, `CMD node dist/main.js`).

### 2b. Target (illustrative)

```mermaid
C4Container
  title Container Diagram: Claims API (target)

  Person(user, "Member / Provider / Analyst")
  System_Ext(idp, "Identity Provider", "OIDC")
  System_Ext(core, "Payer core admin system")

  System_Boundary(sys, "Claims capability") {
    Container(gw, "API gateway", "Managed gateway / WAF", "TLS termination, rate limiting, JWT validation, routing")
    Container(app, "Claims API", "NestJS on containers (k8s / ECS)", "Stateless; authz, validation, audit; horizontally scalable")
    ContainerDb(db, "Claims store", "PostgreSQL (encrypted at rest)", "Read model of claims; money as integer cents / decimal")
    Container(bus, "Event bus", "Kafka / managed queue", "Claim status change events")
    Container(audit, "Audit sink", "Append-only log store", "PHI access records (who, what, when, why)")
  }

  Rel(user, gw, "HTTPS")
  Rel(gw, app, "HTTP, propagates identity")
  Rel(app, idp, "JWKS / token introspection")
  Rel(app, db, "SQL over TLS")
  Rel(app, audit, "Writes access events")
  Rel(core, bus, "Publishes claim changes")
  Rel(bus, app, "Consumed to update read model")
```

---

## Level 3: Components

### 3a. As-is: inside the NestJS application

```mermaid
C4Component
  title Component Diagram: NestJS application (as-is)

  Container_Boundary(app, "NestJS application") {
    Component(main, "main.ts / bootstrap()", "TypeScript", "Creates the Nest app from AppModule and listens on PORT ?? 3000")
    Component(appModule, "AppModule", "@Module", "Composition root; registers ClaimsController and ClaimsService")
    Component(controller, "ClaimsController", "@Controller('claims')", "HTTP adapter. Route: GET /claims")
    Component(service, "ClaimsService", "@Injectable", "Owns in-memory seed data; findAll()")
    Component(model, "Claim", "TypeScript interface", "claimId, memberId, status (PAID | PENDING | DENIED), amount")
  }

  Rel(main, appModule, "NestFactory.create()")
  Rel(appModule, controller, "declares")
  Rel(appModule, service, "provides")
  Rel(controller, service, "constructor injection")
  Rel(service, model, "returns Claim[]")
  Rel(controller, model, "returns Claim[]")
```

Design observations (details in the review):

- Controller and service are cleanly separated, and DI is used correctly.
- There is no repository/port abstraction: the service *is* the data store. Replacing the array with a database means rewriting the service rather than swapping an adapter.
- `Claim` is a plain interface used as both the domain and the wire type (no DTO).
- Cross-cutting concerns (auth, validation, logging, error mapping, OpenAPI) are absent.

### 3b. Target: hexagonal / layered `claims` module (illustrative)

```mermaid
C4Component
  title Component Diagram: claims module (target)

  Container_Boundary(app, "Claims API") {
    Component(guard, "AuthGuard + PolicyGuard", "NestJS guards", "Verifies JWT; enforces member-level access")
    Component(controller, "ClaimsController", "HTTP adapter", "GET /claims, GET /claims/:claimId; maps to DTOs")
    Component(pipe, "ValidationPipe + exception filter", "NestJS", "Input validation; consistent RFC 7807 problem responses")
    Component(service, "ClaimsService", "Application service", "Use cases: list, getById; throws domain errors")
    Component(port, "ClaimsRepository", "Port (abstract class / token)", "findAll(), findById()")
    Component(adapter, "PostgresClaimsRepository", "Adapter", "Implements the port; used in production")
    Component(memory, "InMemoryClaimsRepository", "Adapter", "Seed data; used in tests and local dev")
    Component(auditI, "AuditInterceptor", "NestJS interceptor", "Records every PHI read")
  }

  Rel(guard, controller, "allows")
  Rel(controller, pipe, "uses")
  Rel(controller, service, "calls")
  Rel(service, port, "depends on")
  Rel(adapter, port, "implements")
  Rel(memory, port, "implements")
  Rel(auditI, controller, "wraps")
```

---

## Level 4: Code

### 4a. As-is class diagram

Matches `src/` exactly.

```mermaid
classDiagram
  direction LR

  class Claim {
    <<interface>>
    +string claimId
    +string memberId
    +'PAID'|'PENDING'|'DENIED' status
    +number amount
  }

  class AppModule {
    <<@Module>>
    controllers: ClaimsController
    providers: ClaimsService
  }

  class ClaimsController {
    <<@Controller('claims')>>
    -ClaimsService claimsService
    +getClaims() Claim[]
  }

  class ClaimsService {
    <<@Injectable>>
    -Claim[] claims  (readonly, seeded)
    +findAll() Claim[]
  }

  AppModule ..> ClaimsController : declares
  AppModule ..> ClaimsService : provides
  ClaimsController --> ClaimsService : injects
  ClaimsService o-- Claim : holds 3
  ClaimsController ..> Claim : returns
```

### 4b. Class diagram after implementing the exercise

Additions are marked `«new»`.

```mermaid
classDiagram
  direction LR

  class Claim {
    <<interface>>
    +string claimId
    +string memberId
    +'PAID'|'PENDING'|'DENIED' status
    +number amount
  }

  class ClaimsController {
    <<@Controller('claims')>>
    -ClaimsService claimsService
    +getClaims() Claim[]
    +getClaim(claimId string) Claim  «new»
  }

  class ClaimsService {
    <<@Injectable>>
    -Claim[] claims
    +findAll() Claim[]
    +findById(claimId string) Claim | undefined  «new»
  }

  class NotFoundException {
    <<@nestjs/common>>
    HTTP 404
  }

  ClaimsController --> ClaimsService : injects
  ClaimsService o-- Claim
  ClaimsController ..> NotFoundException : throws when findById is undefined
```

### 4c. Target class diagram (illustrative)

```mermaid
classDiagram
  direction TB

  class Claim {
    <<domain entity>>
    +ClaimId id
    +MemberId memberId
    +ClaimStatus status
    +Money amount
  }
  class Money {
    <<value object>>
    +bigint cents
    +string currency
  }
  class ClaimResponseDto {
    <<DTO>>
    +string claimId
    +string status
    +string amount
    +static from(Claim) ClaimResponseDto
  }
  class ClaimsRepository {
    <<abstract>>
    +findAll() Promise~Claim[]~
    +findById(id ClaimId) Promise~Claim | null~
  }
  class PostgresClaimsRepository
  class InMemoryClaimsRepository
  class ClaimsService {
    +list(principal) Promise~Claim[]~
    +getById(id, principal) Promise~Claim~
  }
  class ClaimNotFoundError
  class ClaimsController {
    +list() ClaimResponseDto[]
    +get(claimId) ClaimResponseDto
  }

  Claim *-- Money
  ClaimsRepository <|-- PostgresClaimsRepository
  ClaimsRepository <|-- InMemoryClaimsRepository
  ClaimsService --> ClaimsRepository
  ClaimsService ..> ClaimNotFoundError : throws
  ClaimsController --> ClaimsService
  ClaimsController ..> ClaimResponseDto : maps to
```

---

## Sequence Diagrams

### S1. Application startup (as-is)

```mermaid
sequenceDiagram
  autonumber
  participant Node as node dist/main.js
  participant Main as bootstrap()
  participant Factory as NestFactory
  participant Module as AppModule
  participant DI as Nest DI container
  participant HTTP as Express server

  Node->>Main: bootstrap()
  Main->>Factory: create(AppModule)
  Factory->>Module: read @Module metadata
  Factory->>DI: register ClaimsService (provider)
  Factory->>DI: instantiate ClaimsController(ClaimsService)
  Factory->>HTTP: map routes (GET /claims)
  Factory-->>Main: INestApplication
  Main->>HTTP: listen(PORT ?? 3000)
```

Note: `bootstrap()` is called without `.catch(...)`; a startup failure becomes an unhandled promise rejection.

### S2. `GET /claims` (as-is)

```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant Express as Express / Nest router
  participant Ctl as ClaimsController
  participant Svc as ClaimsService

  Client->>Express: GET /claims
  Express->>Ctl: getClaims()
  Ctl->>Svc: findAll()
  Svc-->>Ctl: Claim[] (the internal array reference)
  Ctl-->>Express: Claim[]
  Express-->>Client: 200 OK, JSON body (3 claims)
```

### S3. `GET /claims/:claimId`: the exercise (proposed behavior)

```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant Express as Express / Nest router
  participant Ctl as ClaimsController
  participant Svc as ClaimsService
  participant Filter as Nest exception layer

  Client->>Express: GET /claims/CLM-1001
  Express->>Ctl: getClaim("CLM-1001")
  Ctl->>Svc: findById("CLM-1001")
  alt claim exists
    Svc-->>Ctl: Claim
    Ctl-->>Client: 200 OK, Claim JSON
  else claim missing (e.g. CLM-9999)
    Svc-->>Ctl: undefined
    Ctl->>Filter: throw NotFoundException
    Filter-->>Client: 404 {"statusCode":404,"message":"...","error":"Not Found"}
  end
```

### S4. `GET /claims/:claimId` in the target platform (illustrative)

```mermaid
sequenceDiagram
  autonumber
  actor Member
  participant GW as API gateway
  participant Auth as AuthGuard / PolicyGuard
  participant Ctl as ClaimsController
  participant Svc as ClaimsService
  participant Repo as ClaimsRepository
  participant Aud as Audit sink

  Member->>GW: GET /claims/CLM-1001 (Bearer JWT)
  GW->>GW: validate token, rate limit
  GW->>Auth: forward request + identity
  Auth->>Auth: verify scopes
  Auth->>Ctl: allowed
  Ctl->>Svc: getById(id, principal)
  Svc->>Repo: findById(id)
  Repo-->>Svc: Claim | null
  alt found and principal owns claim (or has staff role)
    Svc-->>Ctl: Claim
    Ctl-->>Aud: audit(read, claimId, principal)
    Ctl-->>Member: 200 ClaimResponseDto
  else not found OR not authorized
    Svc-->>Ctl: ClaimNotFoundError
    Ctl-->>Member: 404 problem+json
  end
```

Returning `404` (not `403`) for claims the caller does not own avoids confirming that another member's claim exists.
