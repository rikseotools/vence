/**
 * Helper para determinar el sufijo de tablas materializadas en función del
 * estado de cutover. Permite que los handlers shadow escriban a la tabla
 * canónica (sin sufijo) DESPUÉS del cutover atómico, donde la tabla
 * `_shadow` fue renombrada a su nombre canónico.
 *
 * Flujo de cutover:
 *   1. Antes del cutover (estado actual): `CUTOVER_DONE=false` (o no seteado)
 *      → handlers escriben a `user_article_stats_shadow` etc.
 *      → trigger SQL escribe a `user_article_stats` etc. (la real)
 *
 *   2. Durante cutover atómico (SQL transaction):
 *      - DROP TRIGGER × 20 en test_questions (triggers analíticos)
 *      - BACKFILL real → shadow (sumar counters históricos)
 *      - RENAME `user_article_stats` → `user_article_stats_pre_outbox`
 *      - RENAME `user_article_stats_shadow` → `user_article_stats`
 *
 *   3. Post-cutover: task def con `CUTOVER_DONE=true`
 *      → handlers escriben a `user_article_stats` (que era _shadow, ahora real)
 *      → triggers SQL están desactivados, no escriben a ninguna tabla
 *
 * Ventana de coordinación: tras paso 2 (SQL atomic ~5s) y antes del task def
 * v(N+1) aplicado (~3min rolling), los handlers viejos escribirían a
 * `user_article_stats_shadow` que YA NO EXISTE → fallan. Los events
 * fallidos se acumulan en outbox + retries. Al estabilizar rolling, queue
 * se drena. Pérdida temporal de stats ~3min, no de datos (los users siguen
 * viendo lo que la tabla renombrada (antiguo shadow) tiene + backfill).
 */
export const SHADOW_SUFFIX = process.env.CUTOVER_DONE === 'true' ? '' : '_shadow';

/** Helper para construir nombre de tabla con sufijo condicional. */
export function tableWithSuffix(baseName: string): string {
  return `${baseName}${SHADOW_SUFFIX}`;
}
