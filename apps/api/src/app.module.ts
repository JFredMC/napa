import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { FetchLike } from '@napa/connectors';
import { APP_CONFIG, CLOCK, FETCH, loadConfig, type AppConfig } from './config';
import { RobotsService } from './robots.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

export interface AppDeps {
  config?: AppConfig;
  fetch?: FetchLike;
  clock?: () => Date;
}

@Module({})
export class AppModule {
  static register(deps: AppDeps = {}): DynamicModule {
    const config = deps.config ?? loadConfig();
    return {
      module: AppModule,
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.clientRpm }])],
      controllers: [SearchController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        {
          provide: FETCH,
          useValue: deps.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init)),
        },
        { provide: CLOCK, useValue: deps.clock ?? (() => new Date()) },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        RobotsService,
        SearchService,
      ],
    };
  }
}
