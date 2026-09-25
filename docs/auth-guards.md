# Brief: Where authentication and authorization belong (NestJS Guards)

Source: [architecture-review.md](./architecture-review.md) finding #5 (no authN/authZ) and §6 (security posture).

## Brief

The exercise has no identity provider, so nothing is authenticated. This change marks where auth goes, using NestJS conventions, without implementing it: a placeholder guard on the controller, plus `TODO(auth)` markers where each check belongs. Search the code for `TODO(auth)`.

## Guards, not interceptors

NestJS has a dedicated construct for auth: a **Guard** (`CanActivate`). Its only job is to decide whether a request may reach the handler. Nest's own docs use guards for authentication and role-based authorization; `@nestjs/passport` ships its `AuthGuard` as one.

Request pipeline order:

```text
Middleware → Guards → Interceptors (before) → Pipes → Handler → Interceptors (after) → Exception filters
```

| Construct | Right for auth? | Why |
| --- | --- | --- |
| **Guard** | **Yes** | Runs before interceptors and pipes; has `ExecutionContext`, so it can read handler metadata (`@Roles()`, `@Public()`) through `Reflector`. Throwing `401`/`403` stops the request before validation or data access. |
| Interceptor | No (use for audit) | Runs after guards, so it cannot make the access decision early. It fits **audit logging** of PHI reads (who, what, when), which HIPAA requires. |
| Middleware | Partly | Can parse a token, but does not know which handler will run, so it cannot apply per-route rules. |
| Pipe | No | Transforms and validates input; `ParseClaimIdPipe` stays as-is. |

## What is in the code

| File | Change |
| --- | --- |
| [src/auth/auth.guard.ts](../src/auth/auth.guard.ts) | `AuthGuard implements CanActivate`. Placeholder that returns `true`; TODOs list the JWT verification and role checks it must perform. |
| [src/claims/claims.controller.ts](../src/claims/claims.controller.ts) | `@UseGuards(AuthGuard)` on the class, so every claims route runs the guard. TODOs for role scoping on `GET /claims` and the object-level check on `GET /claims/:claimId`. |
| [src/app.module.ts](../src/app.module.ts) | TODO to move to a global `APP_GUARD` once there are more controllers. |
| [src/auth/auth.guard.spec.ts](../src/auth/auth.guard.spec.ts), [claims.controller.spec.ts](../src/claims/claims.controller.spec.ts) | Pin the placeholder's behaviour, and assert the controller is guarded so the decorator cannot be removed silently. |

**The placeholder allows every request (it fails open).** That is acceptable only because the exercise serves fictitious data. It must be replaced before anything real is served.

## Three layers of check

| Layer | Question | Where | Failure |
| --- | --- | --- | --- |
| Authentication | Who is calling? | `AuthGuard`: verify the bearer JWT against the IdP's JWKS (issuer, audience, expiry), set `request.user` | `401` |
| Role/scope authorization | May this kind of caller use this route? | `RolesGuard` reading `@Roles(...)` metadata | `403` |
| Object-level authorization | May *this* caller see *this* claim? | Controller/service, after loading the claim (a guard cannot see it) | `404`, same as a missing claim |

The object-level check prevents BOLA/IDOR, the top OWASP API risk. Returning `404` rather than `403` for a claim the caller may not see stops attackers learning which claim ids exist.

## Target shape (when an IdP exists)

```ts
// roles.decorator.ts
export const Roles = Reflector.createDecorator<string[]>();

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride(Roles, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!required.some((role) => user?.roles?.includes(role))) throw new ForbiddenException();
    return true;
  }
}

// app.module.ts: secure by default; order matters (authenticate, then authorize)
providers: [
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

- Mark open routes (health, readiness) with a `@Public()` decorator that `AuthGuard` checks first.
- Read the principal in handlers with a `@CurrentUser()` param decorator (`createParamDecorator`) rather than `@Req()`.
- Libraries: `@nestjs/passport` + `passport-jwt`, or `@nestjs/jwt`. Neither is installed; the README asks for no new dependencies unless necessary.
- Guard errors go through the existing `AllExceptionsFilter`, so `401`/`403` responses are logged like any other `4xx`.

## Verification

`npm run build`, `npm run lint`, `npm test` (83 tests) and `npm run test:e2e` (17 tests) pass. HTTP responses are unchanged because the guard allows every request.
