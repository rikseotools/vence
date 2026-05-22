import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BoeChangesService } from './boe-changes/boe-changes.service';

/**
 * Ejecución manual del cron `check-boe-changes` (sin esperar al scheduler).
 * Útil para validación local y para disparos puntuales: `npm run boe:check`.
 *
 * Levanta el contexto de Nest SIN servidor HTTP, ejecuta una verificación y sale.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const service = app.get(BoeChangesService);
    await service.runCheck();
  } catch (error) {
    Logger.error(
      `run-boe falló: ${error instanceof Error ? error.stack : String(error)}`,
      'RunBoe',
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
