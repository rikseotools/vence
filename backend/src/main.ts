// CRÍTICO: import Sentry instrument ANTES que cualquier otro código.
// La auto-instrumentación se aplica al required-tree del proceso, así
// que importar Sentry después NO captura todo (Drizzle, HTTP, etc.).
// Bloque 4 audit Gap b.
import './instrument';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';

/**
 * Red de seguridad a nivel de proceso (incidente 2026-06-01).
 *
 * Por defecto Node mata el proceso ante una unhandled rejection
 * (`--unhandled-rejections=throw`). Un blip de la primaria de BD hizo que
 * una promesa de query rechazara con `DbHandler exited` SIN catch (footgun
 * de `Promise.race` en withTimeout) → el backend entero crasheó (exit 1) y
 * ECS entró en crash-loop de 7 min. Un error transitorio de una request
 * JAMÁS debe tumbar todo el servidor.
 *
 * Política:
 *   - `unhandledRejection`: log + Sentry, NO se sale. Al registrar el
 *     handler, Node deja de convertirla en uncaughtException fatal. La
 *     request afectada ya devolvió su 5xx; el proceso sigue sano.
 *   - `uncaughtException`: log + Sentry y SÍ se sale (1). Un throw síncrono
 *     no capturado deja el proceso en estado indefinido — fail-fast es lo
 *     correcto aquí; ECS levantará una task limpia. Lo que NO queremos es
 *     swallow silencioso de excepciones síncronas.
 */
function installProcessSafetyNet(): void {
  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    Logger.error(`unhandledRejection (no fatal, proceso sigue): ${msg}`, 'Process');
    Sentry.captureException(reason);
  });

  process.on('uncaughtException', (err: Error) => {
    Logger.error(`uncaughtException (fatal, salida limpia): ${err.stack ?? err.message}`, 'Process');
    Sentry.captureException(err);
    // Dar un margen para flush de Sentry/logs antes de salir.
    void Sentry.flush(2000).finally(() => process.exit(1));
  });
}

async function bootstrap(): Promise<void> {
  installProcessSafetyNet();

  const app = await NestFactory.create(AppModule);

  // Graceful shutdown: ECS/Fargate envía SIGTERM al reciclar la task.
  // enableShutdownHooks permite cerrar el scheduler y el pool de BD limpiamente.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Vence backend escuchando en :${port}`, 'Bootstrap');
}

void bootstrap();
