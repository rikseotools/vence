/**
 * ¿Cuántos crons arrancan en el MISMO minuto? Cálculo PURO sobre expresiones cron.
 *
 * ## Por qué existe (T-254, 28/07/2026)
 *
 * El backend ejecuta los `@Cron` **en el mismo contenedor que sirve las peticiones**, así que lo
 * que se lleven ellos de CPU se lo quitan al opositor. Medido ese día: `/api/v2/answer-and-save`
 * tardó **16 s de media** (máx 25 s) y produjo 34 timeouts en un minuto sobre 11 usuarios, con el
 * contenedor del backend al **99,98% de CPU** durante quince minutos — mientras RDS estaba al 8-20%
 * con los créditos llenos y el frontend al 2-6%. No era la base de datos ni el pool.
 *
 * Y el mecanismo no era un cron pesado: **cada uno es rápido** (los rankings insertan 1.890 filas en
 * 48 ms). Lo que satura es que **todos están programados en el mismo instante**. En los logs, entre
 * las 09:30:02 y las 09:30:04 arrancaban a la vez `CheckWebhookHealth`, `RefreshMvOposiciones`,
 * `OutboxProcessor`, `ProcessOutbox`, `AlertsCron` y los cuatro refrescos de `RefreshRankings`.
 *
 * La causa es aritmética: los pasos de 5, 10, 15 y 30 minutos **coinciden todos en el minuto 0 y el 30**.
 * Repartirlos con un desplazamiento (1-56/5, 2-57/5…) mantiene la misma cadencia y deja de
 * apilarlos. Esto lo mide, para que el guardarraíl pueda exigirlo y no se vuelva a colar un cron de paso 5
 * más sobre el montón.
 *
 * Solo se mira el campo de MINUTOS: los crons diarios (`30 6 * * *`) tienen su propio invariante de
 * orden en `content-health-sweep.cron.spec.ts` y no compiten con esto.
 */

/** Minutos de la hora (0-59) en los que dispara el campo de minutos de una expresión cron. */
export function minutosQueDisparan(campoMinutos: string): number[] {
  const campo = String(campoMinutos || '').trim();
  if (!campo) return [];
  const out = new Set<number>();
  for (const parte of campo.split(',')) {
    const [rango, pasoTxt] = parte.split('/');
    const paso = pasoTxt ? Number(pasoTxt) : 1;
    if (!Number.isFinite(paso) || paso <= 0) continue;
    let desde = 0;
    let hasta = 59;
    if (rango !== '*') {
      const [a, b] = rango.split('-');
      desde = Number(a);
      hasta = b === undefined ? (pasoTxt ? 59 : Number(a)) : Number(b);
    }
    if (!Number.isFinite(desde) || !Number.isFinite(hasta)) continue;
    for (let m = desde; m <= Math.min(hasta, 59); m += paso) out.add(m);
  }
  return [...out].sort((x, y) => x - y);
}

/** Cuántas de estas expresiones disparan en cada minuto de la hora. */
export function colisionesPorMinuto(campos: string[]): number[] {
  const cuenta = new Array(60).fill(0);
  for (const c of campos) for (const m of minutosQueDisparan(c)) cuenta[m]++;
  return cuenta;
}

/** El minuto más cargado de la hora y cuántos crons arrancan en él. */
export function peorMinuto(campos: string[]): { minuto: number; n: number } {
  const cuenta = colisionesPorMinuto(campos);
  let minuto = 0;
  for (let m = 1; m < 60; m++) if (cuenta[m] > cuenta[minuto]) minuto = m;
  return { minuto, n: cuenta[minuto] };
}
