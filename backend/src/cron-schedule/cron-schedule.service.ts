import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';
import { CronExpressionParser } from 'cron-parser';

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
  /** Most recent tick the schedule says SHOULD have fired strictly before `now`. */
  prevExpectedTick: Date;
  /** Next tick the schedule will fire on or after `now`. */
  nextExpectedTick: Date;
}

/**
 * Single source of truth for the calendar of @Cron jobs.
 *
 * Reads `SchedulerRegistry` (every @Cron auto-registers via its decorator) and
 * resolves prev/next expected ticks using `cron-parser`. Replaces hardcoded
 * mirror maps that diverge from the actual decorators.
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

  constructor(private readonly registry: SchedulerRegistry) {}

  listCronJobs(now: Date = new Date()): CronJobInfo[] {
    const jobs = this.registry.getCronJobs();
    const out: CronJobInfo[] = [];
    for (const [name, job] of jobs) {
      const info = this.describeJob(name, job, now);
      if (info) out.push(info);
    }
    return out;
  }

  private describeJob(
    name: string,
    job: CronJob,
    now: Date,
  ): CronJobInfo | null {
    const source = job.cronTime?.source;
    if (typeof source !== 'string') {
      return null;
    }
    const timeZone =
      (job.cronTime as { timeZone?: string }).timeZone ?? 'UTC';
    try {
      const parsedForPrev = CronExpressionParser.parse(source, {
        tz: timeZone,
        currentDate: now,
      });
      const prevExpectedTick = parsedForPrev.prev().toDate();
      const parsedForNext = CronExpressionParser.parse(source, {
        tz: timeZone,
        currentDate: now,
      });
      const nextExpectedTick = parsedForNext.next().toDate();
      return {
        name,
        expression: source,
        timeZone,
        prevExpectedTick,
        nextExpectedTick,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to parse cron expression '${source}' for job '${name}': ${msg}`,
      );
      return null;
    }
  }
}
