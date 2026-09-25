import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

type ErrorBody = string | object;

/**
 * Logs every exception that escapes a handler, then replies with the same body Nest's default filter would.
 * 4xx are logged at `warn` (client errors), 5xx and non-HTTP errors at `error` with a stack trace.
 * Unexpected errors never leak their message or stack to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request: unknown = ctx.getRequest();
    const response: unknown = ctx.getResponse();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ErrorBody = isHttp
      ? toBody(exception.getResponse(), statusCode)
      : { statusCode, message: 'Internal server error' };

    const entry = {
      message: exception instanceof Error ? exception.message : String(exception),
      error: exception instanceof Error ? exception.name : typeof exception,
      statusCode,
      method: httpAdapter.getRequestMethod(request),
      path: httpAdapter.getRequestUrl(request),
    };

    if (statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(entry, stack, AllExceptionsFilter.name);
    } else {
      this.logger.warn(entry, AllExceptionsFilter.name);
    }

    // A streaming handler may already have started the response; the error is logged, but it can't be replied to.
    if (!httpAdapter.isHeadersSent(response)) {
      httpAdapter.reply(response, body, statusCode);
    }
  }
}

function toBody(response: ErrorBody, statusCode: number): ErrorBody {
  return typeof response === 'string' ? { statusCode, message: response } : response;
}
