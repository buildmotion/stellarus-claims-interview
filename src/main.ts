import { NestFactory } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { createWinstonOptions } from './logging/winston.config';

// Created before the app so that startup failures are logged through Winston too.
const logger = WinstonModule.createLogger(createWinstonOptions());

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger });
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  logger.error('Application failed to start', error instanceof Error ? error.stack : String(error), 'Bootstrap');
  process.exitCode = 1;
});
