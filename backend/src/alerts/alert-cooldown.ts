import { sql, type SQL } from 'drizzle-orm';

/**
 * Cooldown de las reglas de alerta, PERSISTIDO.
 *
 * ## El agujero que cierra (T-258, medido el 29/07/2026)
 *
 * `AlertsCron` guardaba `lastFiredAt` en un `Map` en memoria del proceso. La
 * cabecera del cron ya lo reconocía ("cuando el proceso se reinicia, todos los
 * cooldowns se resetean") y lo daba por aceptable. No lo era: con deploys
 * frecuentes, cada reinicio reabre el grifo y el canal de email se convierte en
 * spam. Medido sobre `alert_fired`: `canary_pdf_queue_failed` disparó **37**
 * veces en 31 h teniendo `cooldownMin: 60` — el techo teórico eran 31.
 *
 * ## Por qué NO hace falta Redis (que es lo que proponía la cabecera)
 *
 * El propio cron YA escribe cada disparo en `observable_events` como
 * `alert_fired` con `metadata.rule` (se añadió el 21/07 para que "revisa la
 * salud" pudiera ver qué había saltado). Ese registro es exactamente el estado
 * que el cooldown necesita, es persistente y es COMPARTIDO entre instancias.
 * Leerlo resuelve de paso el caso multi-task que la cabecera dejaba pendiente,
 * sin infraestructura nueva ni una segunda fuente de verdad que mantener.
 *
 * ## Contrato
 *
 * - **Fail-open hacia el comportamiento de HOY**: si la consulta falla, el
 *   caller se queda con su `Map` en memoria. Nunca peor que antes del cambio.
 * - **Se toma el MÁXIMO** entre memoria y BD, no el de la BD a secas: dentro de
 *   un mismo proceso la memoria puede ir por delante de lo que la réplica ve
 *   (la escritura de `alert_fired` es fire-and-forget y va a la primaria).
 */

/** Fila cruda de LAST_FIRED_QUERY. `unknown` porque el driver puede dar Date o string. */
export interface LastFiredRow {
  rule: string | null;
  lastFiredAt: string | Date | null;
}

/**
 * Ventana que se consulta hacia atrás. DEBE cubrir el `cooldownMin` más largo
 * de todas las reglas: si una regla tuviera un cooldown mayor que esta ventana,
 * su último disparo caería fuera y el cooldown se perdería EN SILENCIO — el
 * mismo modo de fallo que esta clase existe para cerrar. Hay un test que lo
 * impone contra ALERT_RULES, así que subir un `cooldownMin` por encima de 48 h
 * pone el CI en rojo en vez de degradar el comportamiento sin avisar.
 */
export const LAST_FIRED_LOOKBACK_MIN = 2880; // 48 h

/**
 * Una sola query agregada por tick (no una por regla): el índice
 * `idx_observable_events_event_type_ts` la resuelve por rango.
 */
export const LAST_FIRED_QUERY: SQL = sql`
  SELECT metadata->>'rule' AS "rule",
         MAX(ts)           AS "lastFiredAt"
    FROM observable_events
   WHERE event_type = 'alert_fired'
     AND ts > NOW() - INTERVAL '2880 minutes'
     AND metadata->>'rule' IS NOT NULL
   GROUP BY 1
`;

/**
 * Pura: filas → Map(regla → epoch ms). Descarta filas sin regla o con fecha
 * ilegible en vez de propagar un NaN que envenenaría la comparación.
 */
export function parseLastFired(rows: LastFiredRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows ?? []) {
    const rule = row?.rule;
    if (!rule) continue;
    const raw = row.lastFiredAt;
    if (raw === null || raw === undefined) continue;
    const ms = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
    if (!Number.isFinite(ms)) continue;
    out.set(rule, ms);
  }
  return out;
}

/**
 * Pura: combina el estado en memoria con el persistido quedándose con el
 * disparo MÁS RECIENTE de cada regla. No muta ninguno de los dos.
 */
export function mergeLastFired(
  enMemoria: ReadonlyMap<string, number>,
  persistido: ReadonlyMap<string, number>,
): Map<string, number> {
  const out = new Map<string, number>(enMemoria);
  for (const [rule, ms] of persistido) {
    const previo = out.get(rule);
    if (previo === undefined || ms > previo) out.set(rule, ms);
  }
  return out;
}

/**
 * Pura: ¿la regla está callada por cooldown?
 *
 * Sin disparo previo NO hay cooldown (una regla nueva debe poder avisar ya).
 * Un `lastFiredAt` en el futuro (desfase de reloj entre la BD y el proceso) se
 * trata como cooldown activo: ante un reloj dudoso preferimos un aviso de menos
 * a reabrir el grifo, que es el defecto que esto viene a cerrar.
 */
export function isInCooldown(
  lastFiredAtMs: number | undefined,
  cooldownMin: number,
  nowMs: number,
): boolean {
  if (lastFiredAtMs === undefined) return false;
  if (!Number.isFinite(lastFiredAtMs)) return false;
  const elapsedMin = (nowMs - lastFiredAtMs) / 60_000;
  return elapsedMin < cooldownMin;
}
