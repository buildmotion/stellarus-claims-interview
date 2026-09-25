import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Claim } from './claim';
import { ClaimId } from './claim-id';
import { ClaimsService } from './claims.service';
import { ParseClaimIdPipe } from './parse-claim-id.pipe';

// Every route here requires an authenticated caller; AuthGuard is currently a pass-through placeholder.
@UseGuards(AuthGuard)
@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  // TODO(auth): add @Roles('claims-staff') here, and a member-scoped route (e.g. GET /members/me/claims)
  // that returns only the caller's claims. Never return every claim to an unscoped caller.
  @Get()
  getClaims(): Promise<readonly Claim[]> {
    return this.claimsService.findAll();
  }

  // Static routes (e.g. /claims/search) must be declared above this param route.
  @Get(':claimId')
  async getClaim(@Param('claimId', ParseClaimIdPipe) claimId: ClaimId): Promise<Claim> {
    const claim = await this.claimsService.findById(claimId);
    // TODO(auth): object-level authorization (BOLA/IDOR). Inject the principal (a @CurrentUser() param
    // decorator) and treat a claim the caller may not see (member: claim.memberId !== user.memberId)
    // exactly like a missing one, so the 404 does not reveal which claim ids exist.
    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found`);
    }
    return claim;
  }
}
