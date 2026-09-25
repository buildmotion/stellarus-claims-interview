import { Injectable } from '@nestjs/common';
import { Claim, Money } from './claim';
import { ClaimId } from './claim-id';
import { ClaimsRepository } from './claims.repository';

const usd = (amountMinor: number): Money => ({ amountMinor, currency: 'USD' });
const copy = (claim: Claim): Claim => ({ ...claim, amount: { ...claim.amount } });

/** In-memory adapter for ClaimsRepository. Never exposes its internal array or elements. */
@Injectable()
export class MockDataStore implements ClaimsRepository {
  private readonly claims: Claim[] = [
    { claimId: 'CLM-1001', memberId: 'MBR-101', status: 'PAID', amount: usd(42550) },
    { claimId: 'CLM-1002', memberId: 'MBR-102', status: 'PENDING', amount: usd(81025) },
    { claimId: 'CLM-1003', memberId: 'MBR-103', status: 'DENIED', amount: usd(11999) },
  ];

  async findAll(): Promise<readonly Claim[]> {
    return this.claims.map(copy);
  }

  async findById(claimId: ClaimId): Promise<Claim | undefined> {
    const claim = this.claims.find((c) => c.claimId === claimId);
    return claim && copy(claim);
  }
}
