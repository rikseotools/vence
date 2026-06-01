import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Red de seguridad a nivel de proceso (incidente 2026-06-01).
 *
 * Por defecto Node mata el proceso ante una unhandled rejection
 * (`--unhandled-rejections=throw`). Un blip de la primaria de BD hizo que
 * una promesa de query rechazara con `DbHandler exited` SIN catch → el
 * backend entero crasheó (exit 1) y ECS entró en crash-loop de 7 min. Un
 * error transitorio de una request JAMÁS debe tumbar todo el servidor.
 *
 * Sink = stdout (CloudWatch). Deliberadamente NO emitimos a la BD aquí:
 * cuando este handler dispara, la BD puede ser justo lo que está caído
 * (fue el caso del incidente). CloudWatch es el sink robusto de último
 * recurso — es exactamente desde donde diagnosticamos el crash-loop.
 *
 * Política:
 *   - `unhandledRejection`: log, NO se sale. Al registrar el handler, Node
 *     deja de convertirla en uncaughtException fatal. La request afectada
 *     ya devolvió su 5xx; el proceso sigue sano.
 *   - `uncaughtException`: log y SÍ se sale (1). Un throw síncrono no
 *     capturado deja el proceso en estado indefinido — fail-fast es lo
 *     correcto; ECS levantará una task limpia. Lo que NO queremos es
 *     swallow silencioso de excepciones síncronas.
 */
function installProcessSafetyNet(): void {
  process.on('unhandledRejection', (reason: unknown) => {
    const msg =
      reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    Logger.error(`unhandledRejection (no fatal, proceso sigue): ${msg}`, 'Process');
  });

  process.on('uncaughtException', (err: Error) => {
    Logger.error(
      `uncaughtException (fatal, salida limpia): ${err.stack ?? err.message}`,
      'Process',
    );
    // Margen breve para que el log llegue a stdout/CloudWatch antes de salir.
    setTimeout(() => process.exit(1), 100).unref();
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
