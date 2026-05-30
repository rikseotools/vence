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

/**
 * Ejecuta `work` y actualiza `host[tickField]` con el timestamp tras la
 * ejecución (éxito o error). Propaga excepciones después de marcar el tick.
 *
 * Usar `Date.now()` (ms desde epoch) — el campo TickField debe ser de tipo
 * `number | null`.
 */
export async function runWithHeartbeat<
  T extends Record<TickField, number | null>,
  TickField extends keyof T,
>(host: T, tickField: TickField, work: () => Promise<void>): Promise<void> {
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
