// external-jobs.registry.ts — CATÁLOGO ÚNICO de jobs programados que corren
// FUERA del proceso del backend.
//
// ── Por qué existe (incidente 27→29/07/2026) ────────────────────────────────
// `cron_overdue` juzga la liveness de los crons enumerando `SchedulerRegistry`,
// que SOLO conoce los @Cron in-process. Los jobs que corren en su propio
// contenedor programado eran INVISIBLES para la regla: `temario-pdf-worker`
// dejó de ejecutarse el 27/07 —su imagen fue purgada del registry por la
// política de retención, así que el contenedor fallaba en el pull ANTES de
// arrancar y no emitía absolutamente nada— y estuvo 2 días muerto sin que
// saltara una sola alerta. El único síntoma fue el canary de la cola de PDFs
// quejándose de un backlog que envejecía, que señala al sitio equivocado: la
// cola no estaba atascada, el consumidor no existía.
//
// Un job que muere ANTES de arrancar no puede avisar de su propia muerte. La
// única señal fiable es la AUSENCIA de señal frente a una cadencia declarada,
// que es justo lo que `cron_overdue` ya sabe evaluar.
//
// ── Agnóstico de proveedor, a propósito ─────────────────────────────────────
// Aquí se declara QUÉ job existe y CADA CUÁNTO debe correr. Nunca cómo ni
// dónde se ejecuta. La regla solo compara la cadencia declarada contra las
// señales que el propio job emite a `observable_events`. El día que el
// cómputo se mueva a koigrid cambia el ejecutor —el campo `runner`, que es
// puramente documental y que ninguna regla lee— y ni este catálogo, ni
// `cron_overdue`, ni las alertas, ni el panel se tocan.
//
// ── Contrato que debe cumplir un job para entrar aquí ───────────────────────
//   1. emite `cron_tick` al ARRANCAR, con `endpoint === name`;
//   2. emite `cron_run` al terminar, con `endpoint === name`.
// Es el MISMO contrato que `runWithHeartbeat` da a los @Cron in-process, así
// que ambos mundos se juzgan con la misma regla, disparan la misma alerta y
// salen en el mismo panel. Sin silo nuevo.

// ── FASE vs INTERVALO: declarar la cadencia que el job TIENE ────────────────
// Un job puede estar programado de dos maneras que NO son intercambiables:
//
//   · CON FASE     — «a las 03:00 y a las 03:30», horas de reloj fijas. Es lo
//                    que expresa una expresión cron y lo que hacen los @Cron.
//   · POR INTERVALO— «cada 30 minutos», sin hora de reloj comprometida. Es lo
//                    que hace un `rate(30 minutes)`: la fase la fija el
//                    instante en que se creó la programación y deriva con cada
//                    recreación.
//
// Declarar un job de intervalo como si tuviera fase es declarar algo falso, y
// la vigilancia lo cobra: `temario-pdf-worker` se declaró `*/30 * * * *` (:00
// y :30) mientras sus ticks reales caían a :20 y :50. `cron_overdue` compara
// el último tick real contra el tick de calendario menos un margen del 20 %
// (6 min para 30), así que un desfase constante de 20 min lo marcaba overdue
// en CADA ventana: 4 CRITICAL el 29/07 contra un worker que estaba drenando
// la cola con normalidad. Un aviso crítico diario que siempre es falso es peor
// que no tener aviso — enseña a ignorar el buzón donde también caen los reales.
//
// Por eso la cadencia es una unión discriminada: quien declara el job elige la
// forma que de verdad tiene, y `cron_overdue` juzga cada una con el criterio
// que le corresponde (ver `findOverdueCrons`):
//   · fase     → «¿tickeó en el tick de calendario esperado?»
//   · intervalo→ «¿cuánto hace del último tick, comparado con su periodo?»
// Ambas siguen siendo agnósticas de proveedor: `everyMinutes: 30` describe un
// `rate(30 minutes)` sin nombrarlo, igual que la expresión cron describe un
// `cron(...)`. El guardarraíl de paridad comprueba que la forma declarada
// concuerda con la que documenta `runner`.

interface ExternalScheduledJobBase {
  /**
   * Nombre del job. Es TAMBIÉN el `endpoint` con el que emite `cron_tick` /
   * `cron_run`: la regla une catálogo y señales por este string, así que un
   * typo lo vuelve invisible. Lo fija el guardarraíl de paridad
   * `__tests__/guardrails/externalScheduledJobs.test.ts`.
   */
  readonly name: string;
  /**
   * DOCUMENTAL — dónde corre HOY. Ninguna regla lo lee; existe para que quien
   * diagnostique sepa dónde mirar, y para que la migración de proveedor sea
   * una edición de esta línea. Formato libre.
   */
  readonly runner: string;
  /** Por qué este job vive fuera del proceso del backend. */
  readonly why: string;
}

/** Job con hora de reloj comprometida (el proveedor garantiza la fase). */
export interface PhaseScheduledJob extends ExternalScheduledJobBase {
  readonly cadence: 'phase';
  /**
   * Cadencia en expresión cron estándar (5 campos), NO en el dialecto del
   * proveedor. Portable y parseable por `cron-parser`, igual que las
   * expresiones de los @Cron in-process.
   */
  readonly expression: string;
  /** Zona horaria de la expresión. */
  readonly timeZone: string;
}

/** Job que solo promete un periodo entre ejecuciones, sin hora fija. */
export interface IntervalScheduledJob extends ExternalScheduledJobBase {
  readonly cadence: 'interval';
  /** Periodo entre arranques, en minutos. Sin fase: no promete hora de reloj. */
  readonly everyMinutes: number;
}

export type ExternalScheduledJob = PhaseScheduledJob | IntervalScheduledJob;

export const EXTERNAL_SCHEDULED_JOBS: readonly ExternalScheduledJob[] = [
  {
    name: 'temario-pdf-worker',
    // `rate(30 minutes)` NO tiene fase: sus ticks derivan (medidos a :20 y :50
    // el 29/07, no a :00 y :30). Ver el bloque FASE vs INTERVALO de arriba.
    cadence: 'interval',
    everyMinutes: 30,
    runner:
      'ECS scheduled task `vence-temario-pdf-worker` (EventBridge Scheduler, rate(30 minutes))',
    why:
      'El render de @react-pdf es CPU-bound y llega a ~3 GB y 20 min para un tema grande. ' +
      'Dentro de una task que sirve tráfico tumbaba el health check del ALB (OOM, exit 137, ' +
      '22/07), así que corre fuera del serving y sin ALB delante.',
  },
  {
    name: 'vence-content-radar',
    // `cron(0 6 ? * MON,WED,FRI *)` en EventBridge (tz Europe/Madrid) SÍ tiene fase:
    // hora de reloj fija, a diferencia de `rate()`. [T-325]
    cadence: 'phase',
    expression: '0 6 * * 1,3,5',
    timeZone: 'Europe/Madrid',
    runner:
      'ECS scheduled task `vence-content-radar` (EventBridge Scheduler, ' +
      'cron(0 6 ? * MON,WED,FRI *) tz Europe/Madrid), repo ECR propio — ' +
      'marketing/social-content/content-radar/content_radar.mjs',
    why:
      'Baja los posts recientes de los competidores (Meta Business Discovery) y actualiza ' +
      'content_radar_posts para el panel /admin/radar-contenido. Corre L/X/V porque el ' +
      'contenido de competidores no cambia a diario; runbook: ' +
      'docs/runbooks/radar-contenido-social.md.',
  },
  {
    name: 'vence-instagram-daily',
    // `cron(0 10 * * ? *)` en EventBridge (tz Europe/Madrid). [T-325]
    cadence: 'phase',
    expression: '0 10 * * *',
    timeZone: 'Europe/Madrid',
    runner:
      'ECS scheduled task `vence-instagram-daily` (EventBridge Scheduler, ' +
      'cron(0 10 * * ? *) tz Europe/Madrid), repo ECR propio, migrado de GitHub Actions ' +
      '(2026-07-07) — marketing/social-content/instagram_daily.py',
    why:
      'Publica la "pregunta del día" en @vence.es (Instagram). Se migró de GitHub Actions ' +
      'porque el guard "solo 10:00 Madrid" + los retrasos de cron de GHA hacían que casi ' +
      'nunca disparara; EventBridge Scheduler dispara exacto. Runbook propio pendiente ' +
      '(marketing/social-content/README.md es lo único que hay hoy).',
  },
];

/** Búsqueda por nombre (los tests y el diagnóstico la usan). */
export function findExternalJob(
  name: string,
): ExternalScheduledJob | undefined {
  return EXTERNAL_SCHEDULED_JOBS.find((j) => j.name === name);
}
