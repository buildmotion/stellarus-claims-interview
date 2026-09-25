import { Writable } from 'stream';
import { createLogger, transports } from 'winston';
import { createWinstonOptions } from './winston.config';

/** Builds a real Winston logger from the options, writing to memory instead of the console. */
function capture(env: NodeJS.ProcessEnv) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger({ ...createWinstonOptions(env), transports: [new transports.Stream({ stream })] });
  return { logger, lines };
}

describe('createWinstonOptions', () => {
  it('defaults to info level', () => {
    expect(createWinstonOptions({}).level).toBe('info');
  });

  it.each([
    ['debug', 'debug'],
    ['  WARN ', 'warn'],
    ['error', 'error'],
    ['fatal', 'fatal'],
  ])('accepts LOG_LEVEL=%p as %p', (value, expected) => {
    expect(createWinstonOptions({ LOG_LEVEL: value }).level).toBe(expected);
  });

  it.each(['', 'loud', 'critical', 'info; rm -rf /'])('falls back to info for invalid LOG_LEVEL %p', (value) => {
    expect(createWinstonOptions({ LOG_LEVEL: value }).level).toBe('info');
  });

  it('writes one JSON object per line, with stack, in production', () => {
    const { logger, lines } = capture({ NODE_ENV: 'production' });
    logger.error('lookup failed', { context: 'AllExceptionsFilter', statusCode: 500, stack: ['Error: x\n    at y'] });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: 'error',
      message: 'lookup failed',
      context: 'AllExceptionsFilter',
      statusCode: 500,
      stack: ['Error: x\n    at y'],
    });
    expect(typeof entry.timestamp).toBe('string');
  });

  it('suppresses entries below the configured level', () => {
    const { logger, lines } = capture({ NODE_ENV: 'production', LOG_LEVEL: 'error' });
    logger.warn('ignored');
    logger.error('kept');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).message).toBe('kept');
  });

  it('writes fatal entries (Nest emits them; winston drops unknown levels)', () => {
    const { logger, lines } = capture({ NODE_ENV: 'production', LOG_LEVEL: 'error' });
    logger.log({ level: 'fatal', message: 'cannot recover', context: 'Bootstrap' });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'fatal', message: 'cannot recover' });
  });

  it('uses human-readable output outside production', () => {
    const { logger, lines } = capture({ NODE_ENV: 'development' });
    logger.warn('Claim not found', { context: 'AllExceptionsFilter' });

    expect(lines[0]).toContain('ClaimsApi');
    expect(lines[0]).toContain('Claim not found');
    expect(() => JSON.parse(lines[0])).toThrow();
  });
});
