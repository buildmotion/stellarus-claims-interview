import { BadRequestException } from '@nestjs/common';
import { CLAIM_ID_FORMAT_MESSAGE } from './claim-id';
import { ParseClaimIdPipe } from './parse-claim-id.pipe';

describe('ParseClaimIdPipe', () => {
  const pipe = new ParseClaimIdPipe();

  it('passes a valid claim id through unchanged', () => {
    expect(pipe.transform('CLM-1001')).toBe('CLM-1001');
  });

  it.each(['', 'abc', 'clm-1001', 'CLM-1001 ', undefined, null, 1001])('throws 400 for %p', (value) => {
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
  });

  it('does not echo untrusted input back in the error', () => {
    const hostile = `<script>${'x'.repeat(5_000)}</script>`;
    let caught: unknown;
    try {
      pipe.transform(hostile);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const body = (caught as BadRequestException).getResponse();
    expect(body).toEqual({ statusCode: 400, message: CLAIM_ID_FORMAT_MESSAGE, error: 'Bad Request' });
    expect(JSON.stringify(body)).not.toContain('<script>');
  });
});
