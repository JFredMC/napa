import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, type AppDeps } from './app.module';
import { loadConfig } from './config';

export async function createApp(deps: AppDeps = {}): Promise<INestApplication> {
  const config = deps.config ?? loadConfig();
  const app = await NestFactory.create(AppModule.register({ ...deps, config }), {
    logger: ['log', 'warn', 'error'],
  });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins, methods: ['GET', 'POST'] });
  app.enableShutdownHooks();
  return app;
}

export async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp({ config });
  await app.listen(config.port, '0.0.0.0');
  new Logger('Ñapa').log(
    `API en el puerto ${config.port} (/api) · tiendas en vivo: ${config.liveStores.join(', ') || 'ninguna'}${config.mercadoLibre ? ' + Mercado Libre' : ''}`,
  );
}
