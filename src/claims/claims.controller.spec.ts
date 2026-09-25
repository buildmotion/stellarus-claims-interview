import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { Claim } from './claim';
import { ClaimId } from './claim-id';
import { ClaimsController } from './claims.controller';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { MockDataStore } from './mock-data-store';

describe('ClaimsController', () => {
  let controller: ClaimsController;
  let repository: ClaimsRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClaimsController],
      providers: [ClaimsService, { provide: ClaimsRepository, useClass: MockDataStore }],
    }).compile();

    controller = moduleRef.get(ClaimsController);
    repository = moduleRef.get(ClaimsRepository);
  });

  it('is protected by AuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ClaimsController)).toEqual([AuthGuard]);
  });

  it('returns all seeded claims', async () => {
    const claims = await controller.getClaims();
    expect(claims).toHaveLength(3);
    expect(claims[0].claimId).toBe('CLM-1001');
  });

  it('does not expose internal state to callers', async () => {
    const first = (await controller.getClaims()) as Claim[];
    first.pop();
    first[0].status = 'DENIED';
    const again = await controller.getClaims();
    expect(again).toHaveLength(3);
    expect(again[0].status).toBe('PAID');
  });

  describe('getClaim', () => {
    it('returns the matching claim', async () => {
      await expect(controller.getClaim('CLM-1001' as ClaimId)).resolves.toEqual({
        claimId: 'CLM-1001',
        memberId: 'MBR-101',
        status: 'PAID',
        amount: { amountMinor: 42550, currency: 'USD' },
      });
    });

    it('throws NotFoundException for an unknown claim', async () => {
      const result = controller.getClaim('CLM-9999' as ClaimId);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Claim CLM-9999 not found');
    });

    it('propagates repository failures (the global filter turns them into 500)', async () => {
      jest.spyOn(repository, 'findById').mockRejectedValue(new Error('connection refused'));
      await expect(controller.getClaim('CLM-1001' as ClaimId)).rejects.toThrow('connection refused');
    });
  });
});
