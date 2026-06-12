/**
 * Helpers reutilizables para crons que necesitan heartbeat tracking.
 *
 * En vez de una clase base abstracta (que complica la inyección NestJS
 * cuando los crons ya tienen muchas dependencias), exponemos una utility
 * function que envuelve el work del tick y actualiza un timestamp pasado
 * por referencia.
 *
 * Patrón de uso:
 *
 *   @Injectable()
 *   export class MyCron {
 *     private lastTickAtMs: number | null = null;
 *
 *     constructor(
 *       private readonly service: MyService,
 *       registry: HeartbeatRegistry,
 *     ) {
 *       registry.register(
 *         'my-cron',
 *         () => this.lastTickAtMs !== null ? Date.now() - this.lastTickAtMs : null,
 *         { thresholdMs: 60_000, gracePeriodMs: 120_000 },
 *       );
 *     }
 *
 *     @Cron('* * * * *')
 *     async tick() {
 *       await runWithHeartbeat(this, 'lastTickAtMs', async () => {
 *         await this.service.run();
 *       });
 *     }
 *   }
 *
 * `runWithHeartbeat` actualiza `lastTickAtMs` ANTES de propagar excepciones
 * (worker sigue vivo aunque el batch falle — distinguir "vivo con errores"
 * de "muerto silencioso" es crítico).
 */

import type { ObservabilityService } from '../observability/observability.service';

/**
 * Opciones para emitir la señal de ARRANQUE (`cron_tick`) del tick.
 *
 * Separar arranque de completado es lo que permite a la regla `cron_overdue`
 * medir "¿disparó el scheduler?" (liveness) en vez de "¿terminó el job?". Sin
 * esto, un cron sano pero lento (escaneo LLM, scraper) que emite su `cron_run`
 * de completado 30+ min después del tick aparenta estar overdue durante toda su
 * ejecución → falso positivo que se auto-cura al terminar. Con el tick de
 * arranque, cualquier cron —de 3 s o de 30 min— se juzga por si DISPARÓ.
 */
export interface CronTickOpts {
  /** Nombre del cron (= @Cron name = endpoint del evento `cron_tick`). */
  name: string;
  /** Sink de observabilidad. `this.observability` del cron lo satisface. */
  observability: Pick<ObservabilityService, 'emitFireAndForget'>;
}

/**
 * Ejecuta `work` y actualiza `host[tickField]` con el timestamp tras la
 * ejecución (éxito o error). Propaga excepciones después de marcar el tick.
 *
 * Usar `Date.now()` (ms desde epoch) — el campo TickField debe ser de tipo
 * `number | null`.
 *
 * Si se pasa `opts`, emite un evento `cron_tick` (severity debug) al ARRANCAR,
 * antes de `work`. Es best-effort (fire-and-forget): nunca bloquea ni retrasa
 * el cron, y si se pierde, el `cron_run` de completado actúa de fallback (la
 * regla `cron_overdue` lee ambos). NO toca `host[tickField]` — el heartbeat
 * in-memory del `HeartbeatRegistry` sigue marcándose al completar, para no
 * regresar su detección de cuelgue (un cron que arranca y se cuelga debe
 * seguir quedando "stale" en el registro).
 */
export async function runWithHeartbeat<
  T extends Record<TickField, number | null>,
  TickField extends keyof T,
>(
  host: T,
  tickField: TickField,
  work: () => Promise<void>,
  opts?: CronTickOpts,
): Promise<void> {
  if (opts) {
    opts.observability.emitFireAndForget({
      source: 'fargate',
      severity: 'debug',
      eventType: 'cron_tick',
      endpoint: opts.name,
      metadata: { phase: 'start' },
    });
  }
  try {
    await work();
  } finally {
    // Update SIEMPRE — éxito o excepción. Si la app llegó hasta aquí,
    // el event loop está vivo. El cuelgue silencioso es `await work()`
    // que NUNCA retorna, y entonces este finally tampoco corre — pero
    // ese caso queda cubierto por el statement_timeout de la BD.
    (host as Record<TickField, number | null>)[tickField] = Date.now();
  }
}

/**
 * Lee `host[tickField]` y devuelve ms desde ese timestamp. `null` si nunca tickeado.
 */
export function getLastTickMsAgo<
  T extends Record<TickField, number | null>,
  TickField extends keyof T,
>(host: T, tickField: TickField): number | null {
  const ts = host[tickField];
  return ts === null ? null : Date.now() - ts;
}
