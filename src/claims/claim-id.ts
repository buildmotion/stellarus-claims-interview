/**
 * Public claim identifier, e.g. `CLM-1001`. Upper-case prefix, 1–10 digits, nothing else.
 * The length bound rejects oversize input before it reaches the data layer.
 */
export const CLAIM_ID_PATTERN = /^CLM-\d{1,10}$/;

/**
 * A string proven to match {@link CLAIM_ID_PATTERN}. Only {@link isClaimId} (and the pipe built on it)
 * produces one, so data-layer methods typed with `ClaimId` cannot receive unvalidated input.
 */
export type ClaimId = string & { readonly __brand: 'ClaimId' };

export function isClaimId(value: unknown): value is ClaimId {
  return typeof value === 'string' && CLAIM_ID_PATTERN.test(value);
}

export const CLAIM_ID_FORMAT_MESSAGE = 'Claim Identifier is not valid.';
