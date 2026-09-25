import { Claim } from './claim';
import { ClaimId } from './claim-id';

/** Port: abstracts claim retrieval and persistence. Abstract class doubles as the DI token. */
export abstract class ClaimsRepository {
  abstract findAll(): Promise<readonly Claim[]>;
  /** Resolves `undefined` when no claim has this id; rejects only on infrastructure failure. */
  abstract findById(claimId: ClaimId): Promise<Claim | undefined>;
}
