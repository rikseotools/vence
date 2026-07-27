/**
 * Simulación bank-wide de la regla `cron_started_not_finished` (T-162).
 *
 * Responde a la única pregunta que importa antes de encender una alerta nueva:
 * **¿cuántos correos mandaría hoy, y son reales?** Encender sin medir es como
 * nació el ruido que estamos tratando (T-047, T-160).
 *
 * NO escribe nada. Sólo lee `observable_events`.
 *
 * Comparte el detector REAL (`findStalledCrons` de `alert-rules.ts`) en vez de
 * reimplementarlo: una copia divergiría del día 1 y la simulación mentiría.
 * Lo único que se sustituye es la FUENTE DEL CALENDARIO — en producción viene
 * del decorador `@Cron` vía `SchedulerRegistry`, que aquí no existe (esto no
 * es un proceso Nest). Se deriva el intervalo de la **cadencia observada** de
 * los `cron_tick` en BD, que además es un chequeo independiente: si la cadencia
 * real no cuadra con el decorador, el problema es anterior a esta regla.
 *
 * Uso:  npx tsx backend/scripts/sim-cron-stalled.ts [--dias 30]
 *
 * ⚠️ Vive bajo `backend/` A PROPÓSITO, junto a las demás simulaciones de
 * detectores del backend. El `tsconfig.json` de la raíz EXCLUYE `backend`, así
 * que un script en `scripts/` que importe de `backend/src` arrastra medio
 * NestJS al typecheck de la raíz y lo rompe en CI —donde `backend/node_modules`
 * no existe— aunque en local pase por el symlink de `new-session.sh`. Ese fallo
 * ocurrió de verdad el 27/07 al crear este fichero (familia de T-131).
 */
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import {
  findStalledCrons,
  stallThresholdMs,
  type AlertRuleContext,
  type StalledCronRow,
} from '../src/alerts/alert-rules';

const args = process.argv.slice(2);
const dias = Number(args[args.indexOf('--dias') + 1]) || 30;

const REPO = path.join(__dirname, '..', '..');
const dbUrl =
  process.env.DATABASE_URL ??
  fs
    .readFileSync(path.join(REPO, '.env.local'), 'utf8')
    .match(/^DATABASE_URL=(.*)$/m)![1]
    .trim();

const fmt = (ms: number) =>
  ms >= 3600000
    ? `${(ms / 3600000).toFixed(1)} h`
    : `${Math.round(ms / 60000)} min`;

async function main() {
  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    max: 1,
    connect_timeout: 20,
  });

  // Misma agregación que la query de la regla.
  const rows = (await sql`
    SELECT endpoint,
           COUNT(*) FILTER (WHERE event_type = 'cron_tick')::int AS ticks,
           COUNT(*) FILTER (WHERE event_type = 'cron_run')::int  AS runs,
           MAX(ts) FILTER (WHERE event_type = 'cron_tick') AS "lastTick",
           MAX(ts) FILTER (WHERE event_type = 'cron_run')  AS "lastRun",
           PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE event_type = 'cron_run' AND duration_ms IS NOT NULL)
             AS "p90DurationMs"
    FROM observable_events
    WHERE event_type IN ('cron_tick', 'cron_run')
      AND ts > NOW() - INTERVAL '1 day' * ${dias}
    GROUP BY endpoint
  `) as unknown as StalledCronRow[];

  // Cadencia observada = mediana del delta entre ticks consecutivos.
  const cadence = (await sql`
    SELECT endpoint,
           PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY delta_ms)::bigint AS "intervalMs"
    FROM (
      SELECT endpoint,
             EXTRACT(EPOCH FROM (ts - LAG(ts) OVER (PARTITION BY endpoint ORDER BY ts))) * 1000 AS delta_ms
      FROM observable_events
      WHERE event_type = 'cron_tick' AND ts > NOW() - INTERVAL '1 day' * ${dias}
    ) t
    WHERE delta_ms IS NOT NULL
    GROUP BY endpoint
  `) as unknown as Array<{ endpoint: string; intervalMs: string | number }>;

  const now = new Date();
  const intervalByName = new Map<string, number>();
  for (const c of cadence) intervalByName.set(c.endpoint, Number(c.intervalMs));

  // Stub del calendario: sólo se consume `name` y el delta prev→next.
  const ctx = {
    cronSchedule: {
      listCronJobs: () =>
        [...intervalByName.entries()].map(([name, intervalMs]) => ({
          name,
          expression: '(cadencia observada)',
          timeZone: 'UTC',
          prevExpectedTick: new Date(now.getTime() - intervalMs),
          nextExpectedTick: now,
        })),
    },
  } as unknown as AlertRuleContext;

  const stalled = findStalledCrons(rows, ctx, now);
  const stalledNames = new Set(stalled.map((s) => s.name));

  console.log(`\n=== SIMULACIÓN cron_started_not_finished (${dias} días) ===\n`);

  console.log('DISPARARÍA AHORA MISMO:');
  if (stalled.length === 0) console.log('  (ninguno)');
  for (const s of stalled) {
    console.log(
      `  🔴 ${s.name}\n       arrancó hace ${fmt(s.stalledForMs)} · umbral ${fmt(s.thresholdMs)} · ` +
        `p90 ${s.p90DurationMs != null ? fmt(s.p90DurationMs) : '-'}\n` +
        `       último completado: ${s.lastRun ? s.lastRun.toISOString() : '(ninguno en la ventana)'}`,
    );
  }

  console.log('\nEXCLUIDOS y por qué (esto es lo que evita el inbox ruidoso):');
  const excluded: Record<string, string[]> = {};
  for (const r of rows) {
    if (stalledNames.has(r.endpoint)) continue;
    const intervalMs = intervalByName.get(r.endpoint);
    let motivo: string;
    if (intervalMs === undefined || intervalMs <= 0)
      motivo = 'sin cadencia observable (no es @Cron vivo o tick único)';
    else if (r.runs < 3)
      motivo = `SIN señal de completado (${r.runs} runs / ${r.ticks} ticks) — calla en éxito a propósito`;
    else if (r.lastTick == null) motivo = 'no emite cron_tick (no migrado)';
    else {
      const lastTick = new Date(r.lastTick as string | Date).getTime();
      const lastRun =
        r.lastRun == null
          ? null
          : new Date(r.lastRun as string | Date).getTime();
      if (lastRun != null && lastRun >= lastTick) motivo = 'sano (terminó)';
      else {
        const th = stallThresholdMs(
          r.p90DurationMs == null ? null : Number(r.p90DurationMs),
          intervalMs,
        );
        motivo = `dentro de plazo (lleva ${fmt(now.getTime() - lastTick)} de ${fmt(th)})`;
      }
    }
    (excluded[motivo] ??= []).push(r.endpoint);
  }
  for (const [motivo, names] of Object.entries(excluded).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`  · ${motivo}: ${names.length}`);
    if (!motivo.startsWith('sano')) console.log(`      ${names.join(', ')}`);
  }

  // Retrospectiva: cuántos ticks huérfanos hubo por cron en la ventana. Es la
  // cota superior de avisos que la regla habría mandado si hubiera existido.
  const orphans = (await sql`
    SELECT t.endpoint, COUNT(*)::int AS huerfanos
    FROM observable_events t
    WHERE t.event_type = 'cron_tick'
      AND t.ts > NOW() - INTERVAL '1 day' * ${dias}
      AND NOT EXISTS (
        SELECT 1 FROM observable_events r
        WHERE r.event_type = 'cron_run' AND r.endpoint = t.endpoint
          AND r.ts > t.ts AND r.ts < t.ts + INTERVAL '23 hours'
      )
    GROUP BY t.endpoint HAVING COUNT(*) > 0 ORDER BY COUNT(*) DESC
  `) as unknown as Array<{ endpoint: string; huerfanos: number }>;

  console.log(`\nRETROSPECTIVA — ticks sin completado en ${dias} días:`);
  for (const o of orphans) {
    const r = rows.find((x) => x.endpoint === o.endpoint);
    const juzgado = r && r.runs >= 3 ? 'VIGILADO' : 'excluido (calla en éxito)';
    console.log(
      `  ${String(o.endpoint).padEnd(36)} ${String(o.huerfanos).padStart(4)} huérfanos   [${juzgado}]`,
    );
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error('ERR', e instanceof Error ? e.message : e);
  process.exit(1);
});
