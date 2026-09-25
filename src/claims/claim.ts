export interface Money {
  /** Integer minor units (e.g. cents for USD); never a fractional value. */
  amountMinor: number;
  /** ISO 4217 currency code. */
  currency: 'USD';
}

export interface Claim {
  claimId: string;
  memberId: string;
  status: 'PAID' | 'PENDING' | 'DENIED';
  amount: Money;
}
