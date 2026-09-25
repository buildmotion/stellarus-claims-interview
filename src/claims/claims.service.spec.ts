import { BadRequestException } from '@nestjs/common';
import { Claim } from './claim';
import { ClaimId } from './claim-id';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';

const claim: Claim = {
  claimId: 'CLM-1001',
  memberId: 'MBR-101',
  status: 'PAID',
  amount: { amountMinor: 42550, currency: 'USD' },
};

describe('ClaimsService', () => {
  let repository: jest.Mocked<ClaimsRepository>;
  let service: ClaimsService;

  beforeEach(() => {
    repository = { findAll: jest.fn(), findById: jest.fn() };
    service = new ClaimsService(repository);
  });

  it('findAll delegates to the repository', async () => {
    repository.findAll.mockResolvedValue([claim]);
    await expect(service.findAll()).resolves.toEqual([claim]);
  });

  describe('findById', () => {
    it('returns the claim from the repository', async () => {
      repository.findById.mockResolvedValue(claim);
      await expect(service.findById('CLM-1001' as ClaimId)).resolves.toBe(claim);
      expect(repository.findById).toHaveBeenCalledWith('CLM-1001');
    });

    it('resolves undefined when the repository has no match', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.findById('CLM-9999' as ClaimId)).resolves.toBeUndefined();
    });

    it.each(['', 'abc', 'clm-1001', `CLM-${'9'.repeat(50)}`, undefined, null, 1001])(
      'rejects invalid id %p before touching the repository',
      async (value) => {
        await expect(service.findById(value as unknown as ClaimId)).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.findById).not.toHaveBeenCalled();
      },
    );

    it('propagates repository failures unchanged', async () => {
      const failure = new Error('connection refused');
      repository.findById.mockRejectedValue(failure);
      await expect(service.findById('CLM-1001' as ClaimId)).rejects.toBe(failure);
    });
  });
});
