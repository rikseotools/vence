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

export interface ExternalScheduledJob {
  /**
   * Nombre del job. Es TAMBIÉN el `endpoint` con el que emite `cron_tick` /
   * `cron_run`: la regla une catálogo y señales por este string, así que un
   * typo lo vuelve invisible. Lo fija el guardarraíl de paridad
   * `__tests__/guardrails/externalScheduledJobs.test.ts`.
   */
  readonly name: string;
  /**
   * Cadencia en expresión cron estándar (5 campos), NO en el dialecto del
   * proveedor: un `rate(30 minutes)` del scheduler de turno se declara aquí
   * como la expresión cron equivalente de cada 30 minutos. Portable y
   * parseable por `cron-parser`, igual que las expresiones de los @Cron
   * in-process.
   */
  readonly expression: string;
  /** Zona horaria de la expresión. */
  readonly timeZone: string;
  /**
   * DOCUMENTAL — dónde corre HOY. Ninguna regla lo lee; existe para que quien
   * diagnostique sepa dónde mirar, y para que la migración de proveedor sea
   * una edición de esta línea. Formato libre.
   */
  readonly runner: string;
  /** Por qué este job vive fuera del proceso del backend. */
  readonly why: string;
}

export const EXTERNAL_SCHEDULED_JOBS: readonly ExternalScheduledJob[] = [
  {
    name: 'temario-pdf-worker',
    expression: '*/30 * * * *',
    timeZone: 'UTC',
    runner: 'ECS scheduled task `vence-temario-pdf-worker` (EventBridge Scheduler, rate(30 minutes))',
    why:
      'El render de @react-pdf es CPU-bound y llega a ~3 GB y 20 min para un tema grande. ' +
      'Dentro de una task que sirve tráfico tumbaba el health check del ALB (OOM, exit 137, ' +
      '22/07), así que corre fuera del serving y sin ALB delante.',
  },
];

/** Búsqueda por nombre (los tests y el diagnóstico la usan). */
export function findExternalJob(
  name: string,
): ExternalScheduledJob | undefined {
  return EXTERNAL_SCHEDULED_JOBS.find((j) => j.name === name);
}
