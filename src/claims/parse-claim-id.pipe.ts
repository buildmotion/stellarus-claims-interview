import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CLAIM_ID_FORMAT_MESSAGE, ClaimId, isClaimId } from './claim-id';

/** Validates the `:claimId` route param at the HTTP boundary; rejects with 400 before any data access. */
@Injectable()
export class ParseClaimIdPipe implements PipeTransform<unknown, ClaimId> {
  transform(value: unknown): ClaimId {
    if (!isClaimId(value)) {
      // Deliberately does not echo the input: it is untrusted and may be oversize.
      throw new BadRequestException(CLAIM_ID_FORMAT_MESSAGE);
    }
    return value;
  }
}
