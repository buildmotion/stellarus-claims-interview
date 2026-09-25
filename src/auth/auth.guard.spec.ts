import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  // Placeholder behaviour: replace with 401/403 cases when authentication is implemented.
  it('allows every request until an identity provider is wired in', () => {
    expect(new AuthGuard().canActivate()).toBe(true);
  });
});
