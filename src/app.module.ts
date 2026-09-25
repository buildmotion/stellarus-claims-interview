import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ClaimsController } from './claims/claims.controller';
import { ClaimsRepository } from './claims/claims.repository';
import { ClaimsService } from './claims/claims.service';
import { MockDataStore } from './claims/mock-data-store';
import { AllExceptionsFilter } from './logging/all-exceptions.filter';
import { createWinstonOptions } from './logging/winston.config';

@Module({
  imports: [WinstonModule.forRoot(createWinstonOptions())],
  controllers: [ClaimsController],
  providers: [
    ClaimsService,
    { provide: ClaimsRepository, useClass: MockDataStore },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // TODO(auth): when there is more than one controller, register AuthGuard globally
    // ({ provide: APP_GUARD, useClass: AuthGuard }) so new routes are secure by default, and opt
    // public routes (e.g. health checks) out with a @Public() decorator the guard reads via Reflector.
  ],
})
export class AppModule {}
