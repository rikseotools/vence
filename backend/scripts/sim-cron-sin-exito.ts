#!/usr/bin/env npx tsx
/**
 * backend/scripts/sim-cron-sin-exito.ts — SIMULACIÓN, no escribe nada ni manda emails.
 *
 * Mide contra los `cron_run` REALES a quién dispararía `cron_sin_exito` (T-307) ANTES de
 * dejarla suelta. Misma disciplina que `sim-cadencia-cron-overdue.ts` y `sim-cron-stalled.ts`:
 * una regla de alerta no se calibra razonando, se calibra contra lo que de verdad pasó. Un
 * falso positivo en una alerta por email no es un bug menor — es lo que entrena a ignorarla
 * (la lección de T-047 / T-113 / T-179).
 *
 * NO duplica el criterio: importa el `findCronsSinExito` REAL. Si la regla cambia, esto cambia
 * con ella; una copia del criterio mentiría en cuanto divergieran.
 *
 * El único apaño es el catálogo: `CronScheduleService` lee el `SchedulerRegistry` de Nest, que
 * solo existe con la app levantada. Aquí se reconstruye leyendo los `@Cron('expr', { name })`
 * de los ficheros `*.cron.ts` — la misma técnica que usa `content-health-sweep.cron.spec.ts`.
 *
 * Uso:  npx tsx backend/scripts/sim-cron-sin-exito.ts [--dias 30]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CronScheduleService } from '../src/cron-schedule/cron-schedule.service';
import {
  findCronsSinExito,
  sinExitoThresholdMs,
  type CronSinExitoRow,
  type AlertRuleContext,
} from '../src/alerts/alert-rules';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const argv = process.argv.slice(2);
const arg = (flag: string, def: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const DIAS = Number(arg('--dias', '30'));

/** Todos los `@Cron('expr', { name })` declarados en el backend. */
function cronsDeclarados(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.cron.ts')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(
          /@Cron\(\s*'([^']+)'\s*,\s*\{[^}]*name:\s*'([^']+)'/g,
        )) {
          out.set(m[2], m[1]);
        }
      }
    }
  };
  walk(dir);
  return out;
}

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  if (!url) {
    console.error('❌ falta DATABASE_URL');
    process.exit(2);
  }
  const sql = postgres(url, {
    ssl: { rejectUnauthorized: false },
    onnotice: () => {},
  });

  const declarados = cronsDeclarados(path.resolve(__dirname, '../src'));
  const map = new Map<string, CronJob>();
  for (const [name, expr] of declarados) {
    try {
      map.set(name, new CronJob(expr, () => {}, undefined, false, 'UTC'));
    } catch {
      /* una expresión que `cron` no parsea no puede simularse */
    }
  }
  const registry = { getCronJobs: () => map } as unknown as SchedulerRegistry;
  const svc = new CronScheduleService(registry, []);
  const ctx: AlertRuleContext = { cronSchedule: svc };

  const rows = (await sql.unsafe(
    `SELECT endpoint,
            MAX(ts) AS "lastRun",
            (MAX(ts) FILTER (WHERE severity IN ('error','critical')) = MAX(ts)) AS "lastRunFailed",
            MAX(ts) FILTER (WHERE severity NOT IN ('error','critical')) AS "lastSuccess",
            COUNT(*) FILTER (WHERE severity NOT IN ('error','critical'))::int AS successes,
            COUNT(*) FILTER (WHERE severity IN ('error','critical'))::int AS fallos
       FROM observable_events
      WHERE event_type = 'cron_run' AND endpoint IS NOT NULL
        AND ts > NOW() - INTERVAL '${DIAS} days'
      GROUP BY endpoint
      ORDER BY endpoint`,
  )) as unknown as Array<CronSinExitoRow & { fallos: number }>;

  console.log(
    `\n${rows.length} endpoints con cron_run en ${DIAS} días · ${declarados.size} @Cron declarados\n`,
  );

  const firing = findCronsSinExito(rows, ctx, new Date());

  console.log('── DISPARARÍA sobre ──');
  if (!firing.length) console.log('  (ninguno)');
  for (const e of firing) {
    const h = e.sinExitoMs == null ? null : Math.round(e.sinExitoMs / 3600_000);
    console.log(
      `  🔴 ${e.name}\n       último fallo: ${e.lastRun.toISOString()}\n       último éxito: ${e.lastSuccess ? e.lastSuccess.toISOString() + ` (hace ${h} h)` : '(ninguno)'}\n       tolerancia: ${Math.round(e.thresholdMs / 3600_000)} h`,
    );
  }

  // Los que se quedan fuera y POR QUÉ: es la mitad interesante de una calibración. Un listado
  // de solo los que disparan no permite ver si la guarda está descartando algo que sí importa.
  console.log('\n── descartados (motivo) ──');
  const nombresFiring = new Set(firing.map((e) => e.name));
  for (const r of rows) {
    if (nombresFiring.has(r.endpoint)) continue;
    const expr = declarados.get(r.endpoint);
    let motivo: string;
    if (!expr) motivo = 'no está en el registro de @Cron (externo o retirado)';
    else if (r.successes < 3)
      motivo = `solo ${r.successes} éxito(s): no tiene costumbre de anunciar éxito`;
    else if (!r.lastRunFailed) motivo = 'su último run fue BUENO';
    else {
      const intervalo =
        svc.listCronJobs(new Date()).find((j) => j.name === r.endpoint)
          ?.intervalMs ?? 0;
      const tol = sinExitoThresholdMs(intervalo);
      const sin = r.lastSuccess
        ? Date.now() - new Date(r.lastSuccess).getTime()
        : Infinity;
      motivo = `falló el último, pero tuvo éxito hace ${Math.round(sin / 3600_000)} h (tolerancia ${Math.round(tol / 3600_000)} h)`;
    }
    console.log(`  · ${r.endpoint.padEnd(34)} ${motivo}`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(2);
});
