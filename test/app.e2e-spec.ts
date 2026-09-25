import { Test } from '@nestjs/testing';
import { INestApplication, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CLAIM_ID_FORMAT_MESSAGE } from '../src/claims/claim-id';
import { ClaimsRepository } from '../src/claims/claims.repository';

describe('Claims API (e2e)', () => {
  let app: INestApplication;
  let repository: ClaimsRepository;
  let logger: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    // Replaces the Winston logger so tests stay quiet and can assert what was logged.
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WINSTON_MODULE_NEST_PROVIDER)
      .useValue(logger)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    repository = moduleFixture.get(ClaimsRepository);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /claims returns seeded claims', async () => {
    const response = await request(app.getHttpServer()).get('/claims').expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].claimId).toBe('CLM-1001');
  });

  describe('GET /claims/:claimId', () => {
    it('returns 200 with the matching claim', async () => {
      const response = await request(app.getHttpServer())
        .get('/claims/CLM-1001')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        claimId: 'CLM-1001',
        memberId: 'MBR-101',
        status: 'PAID',
        amount: { amountMinor: 42550, currency: 'USD' },
      });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it.each(['CLM-1001', 'CLM-1002', 'CLM-1003'])('returns seeded claim %s', async (claimId) => {
      const response = await request(app.getHttpServer()).get(`/claims/${claimId}`).expect(200);
      expect(response.body.claimId).toBe(claimId);
    });

    it('returns 404 for a well-formed id that does not exist, and logs a warning', async () => {
      const response = await request(app.getHttpServer()).get('/claims/CLM-9999').expect(404);

      expect(response.body).toEqual({ statusCode: 404, message: 'Claim CLM-9999 not found', error: 'Not Found' });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, method: 'GET', path: '/claims/CLM-9999' }),
        'AllExceptionsFilter',
      );
    });

    it.each([
      ['lower-case id', 'clm-1001'],
      ['arbitrary text', 'abc'],
      ['missing digits', 'CLM-'],
      ['11 digits', 'CLM-12345678901'],
      ['trailing space', 'CLM-1001%20'],
      ['encoded newline', 'CLM-1001%0A'],
      ['encoded path traversal', '..%2Fetc%2Fpasswd'],
      ['SQL injection', "CLM-1'%20OR%20'1'%3D'1"],
      ['oversize id', `CLM-${'1'.repeat(5_000)}`],
    ])('returns 400 for a malformed id (%s) without touching the repository', async (_label, claimId) => {
      const findById = jest.spyOn(repository, 'findById');

      const response = await request(app.getHttpServer()).get(`/claims/${claimId}`).expect(400);

      expect(response.body).toEqual({ statusCode: 400, message: CLAIM_ID_FORMAT_MESSAGE, error: 'Bad Request' });
      expect(findById).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }), 'AllExceptionsFilter');
    });

    it('returns a generic 500 when the repository fails, and logs the error with its stack', async () => {
      jest.spyOn(repository, 'findById').mockRejectedValue(new Error('connect ECONNREFUSED db.internal:5432'));

      const response = await request(app.getHttpServer()).get('/claims/CLM-1001').expect(500);

      expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
      expect(JSON.stringify(response.body)).not.toContain('db.internal');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Error',
          message: 'connect ECONNREFUSED db.internal:5432',
          path: '/claims/CLM-1001',
        }),
        expect.stringContaining('Error: connect ECONNREFUSED'),
        'AllExceptionsFilter',
      );
    });
  });

  it('returns 404 and logs a warning for an unknown route', async () => {
    await request(app.getHttpServer()).get('/claimz').expect(404);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, path: '/claimz' }),
      'AllExceptionsFilter',
    );
  });
});
