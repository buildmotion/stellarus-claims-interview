import { isClaimId } from './claim-id';

describe('isClaimId', () => {
  it.each(['CLM-1001', 'CLM-1', 'CLM-0000000001', 'CLM-9999999999'])('accepts %p', (value) => {
    expect(isClaimId(value)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['missing digits', 'CLM-'],
    ['lower-case prefix', 'clm-1001'],
    ['wrong prefix', 'CLX-1001'],
    ['missing hyphen', 'CLM1001'],
    ['leading whitespace', ' CLM-1001'],
    ['trailing whitespace', 'CLM-1001 '],
    ['trailing newline', 'CLM-1001\n'],
    ['non-digit suffix', 'CLM-10a1'],
    ['negative number', 'CLM--1001'],
    ['decimal number', 'CLM-10.01'],
    ['non-ASCII digits', 'CLM-١٠٠١'],
    ['11 digits (over the length bound)', 'CLM-12345678901'],
    ['oversize input', `CLM-${'1'.repeat(10_000)}`],
    ['SQL injection', "CLM-1001' OR '1'='1"],
    ['path traversal', '../CLM-1001'],
  ])('rejects %s', (_label, value) => {
    expect(isClaimId(value)).toBe(false);
  });

  it.each([undefined, null, 1001, {}, ['CLM-1001'], new String('CLM-1001')])('rejects non-string %p', (value) => {
    expect(isClaimId(value)).toBe(false);
  });
});
