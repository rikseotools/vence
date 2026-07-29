#!/usr/bin/env npx tsx
/**
 * scripts/alerts/sim-cadencia-cron-overdue.ts — SIMULACIÓN, no escribe nada.
 *
 * Mide, sobre los ticks REALES de los jobs externos, cuántas veces habría
 * disparado `cron_overdue` declarando su cadencia como FASE (una expresión
 * cron) frente a declararla por INTERVALO. Misma disciplina que
 * `sim-cooldown-persistido.cjs`: no se da por bueno un cambio de calibración
 * de alertas sin medirlo contra lo que de verdad pasó.
 *
 * Por qué existe (29/07/2026): `temario-pdf-worker` se declaró con una
 * expresión cron de cada 30 min (fase :00/:30) cuando su scheduler es
 * `rate(30 minutes)`, que no compromete hora de reloj. Sus ticks caían a :20 y
 * :50, y la regla los leía como un tick de calendario perdido → 4 CRITICAL en
 * un día contra un worker que estaba drenando la cola con normalidad.
 *
 * NO duplica el criterio: importa el `findOverdueCrons` y el
 * `CronScheduleService` REALES y solo les cambia el catálogo inyectado. Si la
 * regla cambia, esta simulación cambia con ella — una copia del criterio
 * mentiría en cuanto divergieran.
 *
 * Uso:  npx tsx backend/scripts/sim-cadencia-cron-overdue.ts [--dias 7] [--job <nombre>]
 *   (o el atajo integrado:  npm run sim:cadencia-cron -- --dias 7)
 *
 * ⚠️ Vive bajo `backend/` A PROPÓSITO, junto a las demás simulaciones de
 * detectores del backend: el `tsconfig.json` de la raíz EXCLUYE `backend`, así
 * que un script en `scripts/` que importe de `backend/src` arrastra NestJS al
 * typecheck de la raíz y lo rompe. Mismo motivo que `sim-cron-stalled.ts`, que
 * ya lo dejó escrito — y aun así volvió a pasar al crear este fichero.
 */
// Sin `reflect-metadata` a propósito: la simulación instancia
// `CronScheduleService` a mano (no usa el contenedor de Nest), y ese paquete
// vive en `backend/node_modules`, fuera del alcance de este script.
import * as dotenv from 'dotenv'
import postgres from 'postgres'
import {
  CronScheduleService,
  type CronJobInfo,
} from '../src/cron-schedule/cron-schedule.service'
import { findOverdueCrons } from '../src/alerts/alert-rules'
import type { ExternalScheduledJob } from '../src/cron-schedule/external-jobs.registry'

dotenv.config({ path: '.env.local' })

const argv = process.argv.slice(2)
const arg = (flag: string, def: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const DIAS = Number(arg('--dias', '7'))
const JOB = arg('--job', 'temario-pdf-worker')

/** Cadencia del motor de alertas: evalúa cada 5 min (AlertsCron). */
const PASO_MS = 5 * 60_000
/** Cooldown vigente de la regla, para contar CORREOS y no evaluaciones. */
const COOLDOWN_MS = 30 * 60_000

/**
 * `CronScheduleService` sin @Cron in-process: la simulación habla solo de jobs
 * externos, que son los que tienen catálogo. El registry falso evita arrastrar
 * el SchedulerRegistry de Nest.
 */
function servicioCon(jobs: ExternalScheduledJob[]): CronScheduleService {
  const registry = { getCronJobs: () => new Map() } as never
  return new CronScheduleService(registry, jobs)
}

function disparos(
  svc: CronScheduleService,
  ticks: Date[],
  desde: Date,
  hasta: Date,
): { evaluacionesEnRojo: number; correos: number } {
  let evaluacionesEnRojo = 0
  let correos = 0
  let ultimoCorreo = -Infinity
  const ctx = {
    cronSchedule: svc,
    // El backend lleva vivo desde antes de la ventana: así la simulación no se
    // ahorra disparos por el guard de bootstrap, que sería hacer trampa.
    processStartedAtMs: desde.getTime() - 24 * 3600_000,
  } as Parameters<typeof findOverdueCrons>[1]

  for (let t = desde.getTime(); t <= hasta.getTime(); t += PASO_MS) {
    const now = new Date(t)
    // La query real devuelve MAX(ts) de cron_tick ∪ cron_run por endpoint.
    let last: Date | null = null
    for (const tick of ticks) {
      if (tick.getTime() <= t) last = tick
      else break
    }
    const rows = [{ endpoint: JOB, lastTs: last }]
    const overdue = findOverdueCrons(rows, ctx, now)
    if (overdue.length === 0) continue
    evaluacionesEnRojo++
    if (t - ultimoCorreo >= COOLDOWN_MS) {
      correos++
      ultimoCorreo = t
    }
  }
  return { evaluacionesEnRojo, correos }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL en .env.local')
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: false },
  })

  const filas = await sql<{ ts: Date }[]>`
    SELECT ts FROM observable_events
    WHERE endpoint = ${JOB}
      AND event_type IN ('cron_tick', 'cron_run')
      AND ts >= NOW() - ${`${DIAS} days`}::interval
    ORDER BY ts ASC
  `
  // Disparos REALES de la regla en la misma ventana: es el contraste honesto.
  // La simulación reproduce la decisión, no el estado del cooldown en memoria
  // del proceso, así que sus cifras y las reales no tienen por qué coincidir.
  const realesRows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM observable_events
    WHERE event_type = 'alert_fired'
      AND metadata->>'rule' = 'cron_overdue'
      AND metadata->'overdueCrons' ? ${JOB}
      AND ts >= NOW() - ${`${DIAS} days`}::interval
  `
  const reales = realesRows[0]?.n ?? 0
  await sql.end()

  const ticks = filas.map((f) => new Date(f.ts))
  if (ticks.length === 0) {
    console.log(`Sin señales de '${JOB}' en ${DIAS} días — nada que simular.`)
    return
  }
  const desde = ticks[0]
  const hasta = ticks[ticks.length - 1]

  // Fase real de los ticks, que es el dato que delata el problema.
  const minutos = ticks.map((t) => t.getUTCMinutes() % 30)
  const fases = [...new Set(minutos)].sort((a, b) => a - b)

  const antes = disparos(
    servicioCon([
      {
        name: JOB,
        cadence: 'phase',
        expression: '*/30 * * * *',
        timeZone: 'UTC',
        runner: '(simulación: declaración vieja, con fase)',
        why: 'simulación',
      },
    ]),
    ticks,
    desde,
    hasta,
  )
  const despues = disparos(
    servicioCon([
      {
        name: JOB,
        cadence: 'interval',
        everyMinutes: 30,
        runner: '(simulación: declaración nueva, por intervalo)',
        why: 'simulación',
      },
    ]),
    ticks,
    desde,
    hasta,
  )

  const horas = (hasta.getTime() - desde.getTime()) / 3600_000
  console.log(`\nJob: ${JOB}`)
  console.log(
    `Ventana: ${desde.toISOString()} → ${hasta.toISOString()} (${horas.toFixed(1)}h, ${ticks.length} señales)`,
  )
  console.log(
    `Fase real de los ticks (minuto mod 30): ${fases.join(', ')} — una cadencia con fase :00/:30 daría 0`,
  )
  console.log('\n                      evaluaciones en rojo   correos')
  console.log(
    `  ANTES  (fase)          ${String(antes.evaluacionesEnRojo).padStart(10)}   ${String(antes.correos).padStart(9)}`,
  )
  console.log(
    `  DESPUÉS (intervalo)    ${String(despues.evaluacionesEnRojo).padStart(10)}   ${String(despues.correos).padStart(9)}`,
  )
  console.log(
    `\n  Contraste: ${reales} disparo(s) REALES de cron_overdue con este job en ${DIAS}d.`,
  )
  console.log(
    '  (la simulación no reproduce el estado del cooldown en memoria del proceso,',
  )
  console.log('   así que su cifra y la real no tienen por qué coincidir)')
  const evitados = antes.correos - despues.correos
  const dias = horas / 24
  // Sin extrapolar desde ventanas cortas: una tasa "/día" sacada de 6h de
  // señales es un número inventado con cara de medición.
  const tasa =
    dias >= 1 ? ` (${(evitados / dias).toFixed(1)}/día)` : ' — ventana corta, no se extrapola'
  console.log(
    `\n  → ${evitados} correos CRITICAL evitados sobre ${horas.toFixed(1)}h de ticks reales${tasa}`,
  )
  console.log(
    '  (los ticks son REALES: cada correo de la fila ANTES se mandó contra un job que sí estaba corriendo)\n',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
