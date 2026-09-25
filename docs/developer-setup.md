# Developer Setup Guide

How to build, run, test and containerize the Claims API locally.

> **Verification status:** these steps were derived from `package.json`, `Dockerfile`, and the source. They were **not executed** during the review (the review machine had no Node.js installed). Items marked ⚠️ are suspected problems, called out in [architecture-review.md](./architecture-review.md).

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **22 LTS** (matches `Dockerfile`; `@types/node` is v24, which is compatible for development) | Runtime |
| npm | 10+ (ships with Node 22) | Package manager (`package-lock.json` is committed) |
| Docker | Optional, 24+ | Run the container image |
| Git | Any recent | Source control |

Recommended: manage Node with `nvm` or `fnm`.

```bash
# macOS example
brew install nvm            # or: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install 22
nvm use 22
node -v                     # v22.x
```

## 2. Get the code and install

```bash
git clone https://github.com/stellarus-interview-lab/ai-assisted-coding-interview.git
cd ai-assisted-coding-interview
npm ci                      # reproducible install from package-lock.json
```

Use `npm ci` rather than `npm install` so you get exactly the locked versions.

## 3. Run the application

| Goal | Command | Notes |
|---|---|---|
| Dev mode with hot reload | `npm run start:dev` | `nest start --watch` |
| Run once (compiled on the fly) | `npm start` | |
| Production-style run | `npm run build && node dist/main.js` | Uses compiled output in `dist/` |

The server listens on **port 3000** by default. Override it with the `PORT` environment variable:

```bash
PORT=8080 npm run start:dev
```

Smoke test:

```bash
curl -i http://localhost:3000/claims
# 200 OK, JSON array of 3 claims: CLM-1001, CLM-1002, CLM-1003

curl -i http://localhost:3000/claims/CLM-1001
# 200 OK, the claim
curl -i http://localhost:3000/claims/CLM-9999
# 404 Not Found (well-formed id, no such claim)
curl -i http://localhost:3000/claims/abc
# 400 Bad Request (malformed id; format is CLM-<1-10 digits>)
```

## 4. Test, build, lint

| Task | Command | Scope |
|---|---|---|
| Unit tests | `npm test` | `src/**/*.spec.ts`, run serially (`--runInBand`) |
| Unit tests, watch | `npm run test:watch` | |
| End-to-end tests | `npm run test:e2e` | `test/*.e2e-spec.ts`, boots the Nest app in-process via supertest (no port is opened) |
| Build | `npm run build` | `nest build` → `dist/` using `tsconfig.build.json` (excludes specs and `test/`) |
| Lint | `npm run lint` | ⚠️ see troubleshooting: no ESLint config is committed |
| Coverage | `npx jest --coverage` | Output to `coverage/` |

Suggested pre-commit check: `npm run build && npm test && npm run test:e2e`.

## 5. Run in Docker

The `Dockerfile` is a two-stage build (build stage compiles TypeScript; runtime stage installs production dependencies only and runs as the non-root `node` user).

```bash
docker build -t claims-api:local .
docker run --rm -p 3000:3000 claims-api:local
curl http://localhost:3000/claims
```

Custom port: `docker run --rm -e PORT=8080 -p 8080:8080 claims-api:local`.

## 6. Project layout

```
.
├── src/
│   ├── main.ts                     # Bootstrap: Winston app logger, listens on PORT ?? 3000, logs startup failure
│   ├── app.module.ts               # Root module: claims wiring, WinstonModule, global exception filter
│   ├── claims/
│   │   ├── claim.ts                # Claim + Money interfaces (domain types)
│   │   ├── claim-id.ts             # ClaimId branded type + format validation
│   │   ├── parse-claim-id.pipe.ts  # 400 for malformed :claimId
│   │   ├── claims.controller.ts    # HTTP layer: GET /claims, GET /claims/:claimId
│   │   ├── claims.service.ts       # Application layer: delegates to the repository port
│   │   ├── claims.repository.ts    # Port (abstract class, also the DI token)
│   │   ├── mock-data-store.ts      # In-memory adapter with seed data
│   │   └── *.spec.ts               # Unit tests
│   └── logging/
│       ├── winston.config.ts       # Winston options (LOG_LEVEL, JSON in production)
│       ├── all-exceptions.filter.ts# Logs every error, replies with Nest's default error body
│       └── *.spec.ts
├── test/
│   ├── app.e2e-spec.ts             # HTTP-level test through AppModule
│   └── jest-e2e.json               # Jest config for e2e
├── Dockerfile
├── nest-cli.json / tsconfig*.json
└── package.json                    # Scripts + unit-test Jest config (rootDir: src)
```

## 7. Configuration

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | unset (`production` in the Docker runtime stage) | `production` → JSON log lines; otherwise pretty, coloured logs |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`; unknown values fall back to `info` |

There is no `.env` handling, database, or external service; all data is a hard-coded in-memory array (fictitious).

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `EADDRINUSE :::3000` | Another process holds the port. `lsof -i :3000` then kill it, or set `PORT`. |
| `npm run lint` fails with "couldn't find an eslint.config" | ⚠️ ESLint 9 needs a flat `eslint.config.mjs`, and none is committed (nor is `typescript-eslint`). Add one before relying on lint. Note the script uses `--fix`, so it also rewrites files. |
| `npm run test:e2e` fails with `request is not a function` / `supertest_1.default is not a function` | `esModuleInterop` is missing from `tsconfig.json` (confirmed; now fixed). Restore `"esModuleInterop": true` if it was removed. |
| `nest start` / `tsc` fails with many `TS2688: Cannot find type definition file for 'express 2'` (names ending in ` 2`) | The repo is under `~/Documents` with iCloud "Desktop & Documents" sync on; iCloud creates `name 2` conflict copies inside `node_modules`, and TypeScript loads every folder in `node_modules/@types`. Fix: `rm -rf node_modules && npm ci`. Prevent: keep the repo outside iCloud-synced folders (e.g. `~/dev`). |
| Type errors mentioning Node types | Use Node 22 LTS; delete `node_modules` and re-run `npm ci`. |
| Docker build slow / large context | No `.dockerignore` exists, so `node_modules`, `dist`, and `.git` are sent to the daemon. Add one. |
| Stale build output | `dist/` is present in the working tree. Delete it and rebuild: `rm -rf dist && npm run build`. |

## 9. Working on the interview task

The task in the root README: add `GET /claims/:claimId`.
It is implemented; see [reference-implementation.md](./reference-implementation.md). A minimal version touches three files (sketch in [architecture-review.md](./architecture-review.md#7-reference-implementation-of-the-exercise)):

1. `claims.service.ts`: add `findById(claimId): Claim | undefined`.
2. `claims.controller.ts`: add `@Get(':claimId')` that throws `NotFoundException` when the service returns `undefined`.
3. Tests: add a controller unit test (found and not-found) and an e2e test (`200` and `404`).

Then run `npm run build && npm test && npm run test:e2e`.
