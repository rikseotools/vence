import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';
import {
  EXTERNAL_SCHEDULED_JOBS,
  type ExternalScheduledJob,
} from './external-jobs.registry';

/**
 * Token del catálogo de jobs externos. Inyectable a propósito: sin esto el
 * catálogo REAL de producción se colaría en cada test de las reglas de cron y
 * los haría depender de datos de prod (un job nuevo en el catálogo rompería
 * tests que no hablan de él). Los specs inyectan su propio fixture.
 */
export const EXTERNAL_SCHEDULED_JOBS_TOKEN = Symbol('EXTERNAL_SCHEDULED_JOBS');

/**
 * Schedule metadata resolved from a single @Cron registered job.
 *
 * The two timestamps below are the *expected* schedule, not the actual
 * execution. Whether the job actually emitted `cron_run` at `prevExpectedTick`
 * is a separate observation (see RULE_CRON_OVERDUE).
 */
export interface CronJobInfo {
  /** Job name (the `name` passed to @Cron, used as the registry key). */
  name: string;
  /** Raw cron expression literal (e.g. '0 10 * * 1-5'). */
  expression: string;
  /** Timezone declared on the @Cron decorator (defaults to 'UTC'). */
  timeZone: string;
  /**
   * De dónde sale este job:
   *   - `in-process`: un @Cron de ESTE proceso (via `SchedulerRegistry`).
   *   - `external`:   un job programado que corre en su propio contenedor
   *     (`EXTERNAL_SCHEDULED_JOBS`), fuera de este proceso.
   *
   * No es decorativo: las reglas tratan distinto un tick anterior al arranque
   * del proceso según el origen. Ver `findOverdueCrons` en `alert-rules.ts`.
   */
  origin: 'in-process' | 'external';
  /**
   * Forma de la cadencia — determina cómo se juzga la liveness:
   *   - `phase`:    hora de reloj comprometida. `prevExpectedTick` es un tick
   *     de calendario real y la pregunta correcta es «¿tickeó en él?».
   *   - `interval`: solo promete un periodo entre arranques (un `rate(...)` no
   *     tiene fase). La pregunta correcta es «¿cuánto hace del último tick?».
   *
   * Juzgar un job de intervalo con el criterio de fase produce un falso
   * positivo PERMANENTE en cuanto su deriva supera el margen — 4 CRITICAL el
   * 29/07 contra un `temario-pdf-worker` sano. Ver `external-jobs.registry.ts`.
   */
  cadence: 'phase' | 'interval';
  /**
   * Periodo nominal entre ticks. Para `phase` es la distancia entre los dos
   * ticks de calendario; para `interval`, el periodo declarado. Es la base del
   * margen de tolerancia en las reglas.
   */
  intervalMs: number;
  /**
   * Most recent tick the schedule says SHOULD have fired strictly before `now`.
   *
   * ⚠️ Solo es un instante de calendario cuando `cadence === 'phase'`. En
   * `interval` no existe tal cosa: se expone la ventana deslizante
   * (`now - intervalMs`) para que los consumidores que solo necesitan el
   * periodo sigan funcionando, pero NO debe leerse como «tenía que tickear a
   * esta hora» — esa lectura es justo el bug que este campo causó.
   */
  prevExpectedTick: Date;
  /** Next tick the schedule will fire on or after `now` (misma salvedad). */
  nextExpectedTick: Date;
}

/**
 * Single source of truth for the calendar of scheduled jobs.
 *
 * Reads `SchedulerRegistry` (every @Cron auto-registers via its decorator) and
 * resolves prev/next expected ticks using `cron-parser`. Replaces hardcoded
 * mirror maps that diverge from the actual decorators.
 *
 * Desde 29/07/2026 incluye TAMBIÉN los jobs que corren fuera de este proceso,
 * declarados en `EXTERNAL_SCHEDULED_JOBS`. Motivo: `SchedulerRegistry` solo ve
 * los @Cron locales, así que un job en su propio contenedor programado no
 * tenía liveness ninguna — `temario-pdf-worker` estuvo 2 días muerto (su
 * imagen fue purgada del registry y el contenedor fallaba en el pull antes de
 * arrancar) sin una sola alerta. El catálogo declara cadencia, no proveedor:
 * ver la cabecera de `external-jobs.registry.ts`.
 *
 * Background — 31/05/2026 incident: a hardcoded `CRON_EXPECTED` map in
 * `alert-rules.ts` listed `{ intervalMin, daysOfWeek }` for each cron, plus a
 * heuristic margin (`intervalMin * 2 + 30`) computed from the last valid day.
 * The heuristic broke when a cron skipped *two* consecutive scheduled runs:
 * `detect-oep-llm` (`0 10 * * 1-5`) did not fire on Thu 28 nor Fri 29 (outbox
 * @EVERY_SECOND incident) and triggered "cron overdue" alerts every hour
 * across the weekend. The robust answer is to ask the schedule itself "when
 * was the last tick you were supposed to fire?", which is exactly `prev()`.
 *
 * @Interval-registered jobs (e.g. outbox-processor) are NOT returned here — they
 * are covered by `HeartbeatRegistry` and the `/health` endpoints, which are the
 * right tool for sub-minute heartbeats.
 */
@Injectable()
export class CronScheduleService {
  private readonly logger = new Logger(CronScheduleService.name);

  private readonly externalJobs: readonly ExternalScheduledJob[];

  constructor(
    private readonly registry: SchedulerRegistry,
    @Optional()
    @Inject(EXTERNAL_SCHEDULED_JOBS_TOKEN)
    externalJobs?: readonly ExternalScheduledJob[],
  ) {
    this.externalJobs = externalJobs ?? EXTERNAL_SCHEDULED_JOBS;
  }

  /**
   * Calendario COMPLETO de jobs programados: los @Cron de este proceso más los
   * declarados en `EXTERNAL_SCHEDULED_JOBS` (que corren en su propio
   * contenedor). Ambos se juzgan con las mismas reglas — un job externo que no
   * arranca no emite nada, y la ausencia de señal frente a su cadencia
   * declarada es exactamente lo que `cron_overdue` sabe detectar.
   *
   * Si un nombre externo colisiona con un @Cron in-process, gana el
   * in-process: el proceso vivo es evidencia más fuerte que una declaración.
   */
  listCronJobs(now: Date = new Date()): CronJobInfo[] {
    const out: CronJobInfo[] = [];
    const seen = new Set<string>();

    for (const [name, job] of this.registry.getCronJobs()) {
      const source = job.cronTime?.source;
      if (typeof source !== 'string') continue;
      const timeZone = (job.cronTime as { timeZone?: string }).timeZone ?? 'UTC';
      const info = this.resolveTicks(name, source, timeZone, now, 'in-process');
      if (info) {
        out.push(info);
        seen.add(name);
      }
    }

    for (const job of this.externalJobs) {
      if (seen.has(job.name)) continue;
      if (job.cadence === 'interval') {
        const intervalMs = job.everyMinutes * 60_000;
        if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
          this.logger.warn(
            `Job externo '${job.name}' declara everyMinutes inválido: ${job.everyMinutes}`,
          );
          continue;
        }
        out.push({
          name: job.name,
          // Lo que se enseña en el email y en el panel. No es una expresión
          // cron a propósito: este job no promete hora de reloj, y escribir
          // una haría creer lo contrario a quien diagnostique.
          expression: `cada ${job.everyMinutes} min`,
          timeZone: 'UTC',
          origin: 'external',
          cadence: 'interval',
          intervalMs,
          prevExpectedTick: new Date(now.getTime() - intervalMs),
          nextExpectedTick: new Date(now.getTime() + intervalMs),
        });
        continue;
      }
      const info = this.resolveTicks(
        job.name,
        job.expression,
        job.timeZone,
        now,
        'external',
      );
      if (info) out.push(info);
    }

    return out;
  }

  private resolveTicks(
    name: string,
    expression: string,
    timeZone: string,
    now: Date,
    origin: CronJobInfo['origin'],
  ): CronJobInfo | null {
    try {
      const parsedForPrev = CronExpressionParser.parse(expression, {
        tz: timeZone,
        currentDate: now,
      });
      const prevExpectedTick = parsedForPrev.prev().toDate();
      const parsedForNext = CronExpressionParser.parse(expression, {
        tz: timeZone,
        currentDate: now,
      });
      const nextExpectedTick = parsedForNext.next().toDate();
      return {
        name,
        expression,
        timeZone,
        origin,
        cadence: 'phase',
        intervalMs: nextExpectedTick.getTime() - prevExpectedTick.getTime(),
        prevExpectedTick,
        nextExpectedTick,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to parse cron expression '${expression}' for job '${name}': ${msg}`,
      );
      return null;
    }
  }
}
