import { CanActivate, Injectable } from '@nestjs/common';

/**
 * Authentication and authorization seam for HTTP controllers (see docs/auth-guards.md).
 *
 * Nest runs guards after middleware and before interceptors and pipes, so a guard that throws
 * rejects the request before any validation or data access. The exercise has no identity
 * provider, so this placeholder allows every request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    // TODO(auth): authenticate. Replace this placeholder before any real data is served:
    //   1. Read the bearer token from the Authorization header (context.switchToHttp().getRequest()).
    //   2. Verify signature, issuer, audience and expiry against the IdP's JWKS
    //      (e.g. @nestjs/passport + passport-jwt, or @nestjs/jwt).
    //   3. Attach the verified principal (subject, memberId, roles/scopes) to request.user.
    //   4. Throw UnauthorizedException (401) when the token is missing or invalid.
    // TODO(auth): authorize by role/scope. Read the roles a @Roles() decorator sets on the handler
    //   (Reflector) and throw ForbiddenException (403) when the principal lacks them, or split this
    //   into a separate RolesGuard. Object-level checks need the loaded claim, so they live in the
    //   controller/service, not here.
    return true;
  }
}
