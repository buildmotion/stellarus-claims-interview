import { BadRequestException, Injectable } from '@nestjs/common';
import { Claim } from './claim';
import { CLAIM_ID_FORMAT_MESSAGE, ClaimId, isClaimId } from './claim-id';
import { ClaimsRepository } from './claims.repository';

@Injectable()
export class ClaimsService {
  constructor(private readonly repository: ClaimsRepository) {}

  findAll(): Promise<readonly Claim[]> {
    return this.repository.findAll();
  }

  /**
   * Returns `undefined` when the claim does not exist; mapping that to 404 is the caller's concern.
   * Re-checks the id at runtime so non-HTTP callers (or a cast around `ClaimId`) cannot reach the store unvalidated.
   */
  async findById(claimId: ClaimId): Promise<Claim | undefined> {
    if (!isClaimId(claimId)) {
      throw new BadRequestException(CLAIM_ID_FORMAT_MESSAGE);
    }
    return this.repository.findById(claimId);
  }
}
