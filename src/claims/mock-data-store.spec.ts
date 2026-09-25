import { ClaimId } from './claim-id';
import { MockDataStore } from './mock-data-store';

const id = (value: string) => value as ClaimId;

describe('MockDataStore', () => {
  let store: MockDataStore;

  beforeEach(() => {
    store = new MockDataStore();
  });

  describe('findById', () => {
    it.each(['CLM-1001', 'CLM-1002', 'CLM-1003'])('finds seeded claim %s', async (claimId) => {
      const claim = await store.findById(id(claimId));
      expect(claim?.claimId).toBe(claimId);
    });

    it('returns the full claim shape', async () => {
      await expect(store.findById(id('CLM-1002'))).resolves.toEqual({
        claimId: 'CLM-1002',
        memberId: 'MBR-102',
        status: 'PENDING',
        amount: { amountMinor: 81025, currency: 'USD' },
      });
    });

    it('resolves undefined for an unknown claim id', async () => {
      await expect(store.findById(id('CLM-9999'))).resolves.toBeUndefined();
    });

    it('does not match on prefix or substring', async () => {
      await expect(store.findById(id('CLM-100'))).resolves.toBeUndefined();
      await expect(store.findById(id('CLM-10011'))).resolves.toBeUndefined();
    });

    it('returns a deep copy, so callers cannot mutate the store', async () => {
      const first = await store.findById(id('CLM-1001'));
      first!.status = 'DENIED';
      first!.amount.amountMinor = 0;

      const again = await store.findById(id('CLM-1001'));
      expect(again?.status).toBe('PAID');
      expect(again?.amount.amountMinor).toBe(42550);
    });
  });

  describe('findAll', () => {
    it('returns deep copies of every claim', async () => {
      const claims = await store.findAll();
      claims[0].amount.amountMinor = 0;
      expect((await store.findAll())[0].amount.amountMinor).toBe(42550);
    });
  });
});
