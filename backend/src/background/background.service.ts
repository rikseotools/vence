import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio para ejecutar tareas tras enviar la response al cliente
 * (equivalente al `after()` block de Next.js — no nativo en Nest/Express).
 *
 * Patrón fire-and-forget: el `runAfter(fn)` programa el callback para
 * el siguiente tick del event loop vía `setImmediate`. La response actual
 * ya está siendo serializada/enviada — no se bloquea.
 *
 * Errores capturados con try/catch + log warn. NUNCA crashear el proceso
 * por una tarea de background.
 *
 * Uso típico desde un Controller:
 *   ```ts
 *   @Post()
 *   async post(@CurrentUser() user, @Body() body) {
 *     const result = await this.service.saveAnswer(body, user.userId);
 *     this.bg.runAfter(() => this.service.markActiveStudentIfFirst(user.userId));
 *     this.bg.runAfter(() => this.cache.invalidateMany([`user_stats:${user.userId}`]));
 *     return result;
 *   }
 *   ```
 */
@Injectable()
export class BackgroundService {
  private readonly logger = new Logger(BackgroundService.name);

  /**
   * Programa `fn` para ejecutar en el siguiente tick del event loop.
   * `fn` puede ser sync o async; cualquier throw/rejection se captura
   * y loggea sin propagar.
   *
   * @param fn Callback a ejecutar tras response. Puede devolver void o Promise<void>.
   * @param label Etiqueta opcional para identificar la tarea en logs.
   */
  runAfter(fn: () => void | Promise<void>, label = 'background-task'): void {
    setImmediate(() => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          result.catch((err) => {
            this.logger.warn(`Error en ${label}:`, err);
          });
        }
      } catch (err) {
        this.logger.warn(`Error sincrono en ${label}:`, err);
      }
    });
  }
}
