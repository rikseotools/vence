/**
 * Cuántas filas afectó un `db.execute(...)` de escritura. (T-613)
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────
 * Hablamos con Postgres por **postgres-js**, cuyo resultado de un `DELETE`/`UPDATE`
 * **sin `RETURNING`** es un array VACÍO con las filas afectadas en **`.count`**.
 * `rowCount` es de **node-postgres** y aquí vale `undefined` SIEMPRE.
 *
 * El código leía `res.rowCount ?? res.length ?? 0`, o sea **0 siempre**. En un
 * drenador por lotes eso no es un log inexacto: el bucle corta con
 * `if (n < batchSize) break`, así que `0 < batchSize` lo sacaba en la PRIMERA
 * vuelta. `telemetry-retention` borraba 50 k en vez de 2,5 M por noche y
 * `archive-interactions` 10 k en vez de 200 k, las dos diciendo «0 filas» con
 * `status: 'success'` — que se lee igual que «no había nada que borrar». Semanas
 * en verde con las dos tablas más grandes de la BD (6,9 GB y 10 GB) creciendo sin
 * freno y 2,7 M + 2,4 M filas atrasadas.
 *
 * El orden de lectura NO es arbitrario:
 *   1. `count`    — postgres-js, nuestro driver (`drizzle-orm/postgres-js` en los dos árboles).
 *   2. `rowCount` — node-postgres, por si un día se cambia de driver o se mezcla `pg`.
 *   3. `length`   — con `RETURNING`, las filas devueltas. postgres-js pone además
 *                   `count` con el mismo número, así que este caso ya lo cubre (1);
 *                   queda de red por si el resultado llega envuelto por otra capa.
 *
 * Espejo exacto en `lib/db/filasAfectadas.ts` (el backend NO puede importar de
 * `lib/` en runtime: su imagen no la lleva). Paridad vigilada por
 * `__tests__/guardrails/filasAfectadas.guardrail.test.ts`.
 */
export function filasAfectadas(res: unknown): number {
  if (res === null || res === undefined) return 0;
  const r = res as { count?: unknown; rowCount?: unknown; length?: unknown };
  for (const valor of [r.count, r.rowCount, r.length]) {
    if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {
      return valor;
    }
  }
  return 0;
}
