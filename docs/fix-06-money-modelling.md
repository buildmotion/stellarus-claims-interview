# Fix: Issue #6 – Money modelled as `number`

Source: [architecture-review.md](./architecture-review.md) finding #6 (Medium, domain modelling).

## Problem

`Claim.amount` was a floating-point `number` (e.g. `425.5`). Binary floats cannot represent most decimal fractions exactly, so summing or comparing amounts drifts (`0.1 + 0.2 !== 0.3`). The amount also carried no currency.

## Change

- [src/claims/claim.ts](../src/claims/claim.ts): added `Money { amountMinor: number; currency: 'USD' }`; `Claim.amount` is now `Money`. `amountMinor` is an integer count of minor units (cents).
- [src/claims/claims.service.ts](../src/claims/claims.service.ts): seed data uses a `usd(cents)` helper.

| Claim | Before | After |
| --- | --- | --- |
| CLM-1001 | `425.5` | `{ amountMinor: 42550, currency: 'USD' }` |
| CLM-1002 | `810.25` | `{ amountMinor: 81025, currency: 'USD' }` |
| CLM-1003 | `119.99` | `{ amountMinor: 11999, currency: 'USD' }` |

## Impact

- **Breaking wire change** for `GET /claims`: `amount` is now an object. No other usages existed in `src/`, `test/` or the README.
- Format for display at the edge only (`amountMinor / 100`, or `Intl.NumberFormat`).

## Follow-ups

- Widen `currency` beyond `'USD'` if needed; use `bigint` or a decimal library if values could exceed `Number.MAX_SAFE_INTEGER`.
- Persist as `BIGINT` minor units plus a currency column.
- Verified: `npm run build` and `npm test` pass. e2e not run.
