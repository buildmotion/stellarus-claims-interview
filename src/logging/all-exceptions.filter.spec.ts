import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  LoggerService,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const request = { method: 'GET', url: '/claims/CLM-1001' };
  const response = {};
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  let httpAdapter: {
    getRequestMethod: jest.Mock;
    getRequestUrl: jest.Mock;
    isHeadersSent: jest.Mock;
    reply: jest.Mock;
  };
  let logger: jest.Mocked<Pick<LoggerService, 'log' | 'warn' | 'error'>>;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    httpAdapter = {
      getRequestMethod: jest.fn((req: typeof request) => req.method),
      getRequestUrl: jest.fn((req: typeof request) => req.url),
      isHeadersSent: jest.fn(() => false),
      reply: jest.fn(),
    };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    filter = new AllExceptionsFilter(
      { httpAdapter } as unknown as HttpAdapterHost,
      logger as unknown as LoggerService,
    );
  });

  it('logs a 4xx HttpException at warn and replies with its body', () => {
    filter.catch(new NotFoundException('Claim CLM-1001 not found'), host);

    expect(logger.warn).toHaveBeenCalledWith(
      {
        message: 'Claim CLM-1001 not found',
        error: 'NotFoundException',
        statusCode: 404,
        method: 'GET',
        path: '/claims/CLM-1001',
      },
      'AllExceptionsFilter',
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 404, message: 'Claim CLM-1001 not found', error: 'Not Found' },
      404,
    );
  });

  it('keeps structured validation bodies intact', () => {
    filter.catch(new BadRequestException(['field a is invalid', 'field b is invalid']), host);

    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 400, message: ['field a is invalid', 'field b is invalid'], error: 'Bad Request' },
      400,
    );
  });

  it('wraps a string HttpException response in the standard shape', () => {
    filter.catch(new HttpException('Teapot', HttpStatus.I_AM_A_TEAPOT), host);

    expect(httpAdapter.reply).toHaveBeenCalledWith(response, { statusCode: 418, message: 'Teapot' }, 418);
  });

  it('logs a 5xx HttpException at error with its stack', () => {
    const exception = new ServiceUnavailableException('Store offline');
    filter.catch(exception, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 503, error: 'ServiceUnavailableException', message: 'Store offline' }),
      exception.stack,
      'AllExceptionsFilter',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs an unexpected Error at error and hides its details from the client', () => {
    const exception = new TypeError('Cannot read properties of undefined (password=hunter2)');
    filter.catch(exception, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'TypeError', message: exception.message }),
      exception.stack,
      'AllExceptionsFilter',
    );
    expect(httpAdapter.reply).toHaveBeenCalledWith(response, { statusCode: 500, message: 'Internal server error' }, 500);
  });

  it.each([
    ['a string', 'boom', 'string'],
    ['undefined', undefined, 'undefined'],
    ['a plain object', { code: 'E_DB' }, 'object'],
  ])('handles a thrown non-Error (%s) as 500', (_label, thrown, type) => {
    filter.catch(thrown, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: type, message: String(thrown) }),
      undefined,
      'AllExceptionsFilter',
    );
    expect(httpAdapter.reply).toHaveBeenCalledWith(response, { statusCode: 500, message: 'Internal server error' }, 500);
  });

  it('still logs, but does not reply, when headers were already sent', () => {
    httpAdapter.isHeadersSent.mockReturnValue(true);
    filter.catch(new Error('stream broke'), host);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(httpAdapter.reply).not.toHaveBeenCalled();
  });
});
