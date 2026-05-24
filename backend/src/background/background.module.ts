import { Global, Module } from '@nestjs/common';
import { BackgroundService } from './background.service';

/**
 * Módulo Global para fire-and-forget tasks tras response.
 *
 * Equivalente al `after()` block de Next.js (no existe nativo en
 * Express/Nest). El service expone `runAfter(fn)` que ejecuta el
 * callback vía `setImmediate` para no bloquear la response actual.
 *
 * Reusable para cualquier endpoint que necesite trabajo de background
 * tras devolver respuesta al cliente (analytics, invalidación de cache,
 * marcado de flags, etc.).
 */
@Global()
@Module({
  providers: [BackgroundService],
  exports: [BackgroundService],
})
export class BackgroundModule {}
