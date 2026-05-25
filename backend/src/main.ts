// CRÍTICO: import Sentry instrument ANTES que cualquier otro código.
// La auto-instrumentación se aplica al required-tree del proceso, así
// que importar Sentry después NO captura todo (Drizzle, HTTP, etc.).
// Bloque 4 audit Gap b.
import './instrument';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown: ECS/Fargate envía SIGTERM al reciclar la task.
  // enableShutdownHooks permite cerrar el scheduler y el pool de BD limpiamente.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Vence backend escuchando en :${port}`, 'Bootstrap');
}

void bootstrap();
