# Fix: Issue #7 – `findAll()` returns the internal mutable array by reference

Source: [architecture-review.md](./architecture-review.md) finding #7 (Low, encapsulation); also addresses #8 (no persistence abstraction).

## Brief

`ClaimsService.findAll()` returned `this.claims`, the private array itself. Any caller (controller, interceptor, test) could `push`, `pop`, `sort` or edit an element, silently changing state shared by every later request. `private readonly` only protects the reference, not the contents. Risk is low today (one caller, seed data) but becomes a data-integrity bug once the store is shared or cached.

## Fix: Repository pattern

Data retrieval and persistence are now behind a port; the service no longer owns data.

```
ClaimsController → ClaimsService → ClaimsRepository (port) ← MockDataStore (adapter)
```

| File                                                                  | Role                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [src/claims/claims.repository.ts](../src/claims/claims.repository.ts) | `ClaimsRepository` abstract class: the port and the Nest DI token. `findAll(): Promise<readonly Claim[]>` |
| [src/claims/mock-data-store.ts](../src/claims/mock-data-store.ts)     | `MockDataStore`: in-memory adapter holding the seed claims. Returns deep copies, never its internal array |
| [src/claims/claims.service.ts](../src/claims/claims.service.ts)       | Depends only on `ClaimsRepository`                                                                        |
| [src/app.module.ts](../src/app.module.ts)                             | Binds `{ provide: ClaimsRepository, useClass: MockDataStore }`                                            |
| [src/claims/claims.controller.ts](../src/claims/claims.controller.ts) | `getClaims()` returns `Promise<readonly Claim[]>`                                                         |

Design notes

- **Async contract:** methods return `Promise` so a real database adapter drops in without changing callers. The HTTP response is unchanged.
- **Two layers of protection:** `readonly Claim[]` stops mutation at compile time; copying stops it at runtime.
- **Abstract class over interface + string token:** no `@Inject` boilerplate, and the token is type-safe.
- Operations are unchanged (`findAll` only). Add `findById`/`save` to the port as the exercise or platform needs them.

## Swapping in a real store

Implement `ClaimsRepository` (e.g. `PostgresClaimsRepository`) and change one line in `AppModule`. Service and controller are untouched. Test the service with a stub repository.

## Verification

`npm run build` and `npm test` pass (2 tests, including a new one that mutates a returned result and asserts the store is unaffected). e2e not run.
