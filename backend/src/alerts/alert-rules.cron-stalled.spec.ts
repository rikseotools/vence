import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import {
  CronScheduleService,
  EXTERNAL_SCHEDULED_JOBS_TOKEN,
} from '../cron-schedule/cron-schedule.service';
import {
  RULE_CRON_STARTED_NOT_FINISHED,
  findStalledCrons,
  stallThresholdMs,
  type AlertRuleContext,
  type StalledCronRow,
} from './alert-rules';

/**
 * Tests de `cron_started_not_finished` (T-162) — el complemento de
 * `cron_overdue`: aquélla vigila el ARRANQUE, ésta el COMPLETADO.
 *
 * Los casos NO son inventados: salen de medir `observable_events` el 27/07/2026
 * (30 días). Quien toque una constante ve exactamente qué crons reales cambian
 * de veredicto.
 *
 *   - `detect-notas-convocatoria`: 30 ticks / 17 runs, 13 huérfanos → el caso
 *     que origina la regla. DEBE dispararse.
 *   - `served-coverage` y los seis `trigger-*`: 20 ticks / 0 runs. Callan en
 *     éxito a propósito → NUNCA deben dispararse.
 *   - `pool-capacity-sampler`: 43.308 ticks / 1 run (emite sólo al fallar).
 *     Es la contraprueba de por qué el listón está en 3 y no en 1.
 *   - `outbox-processor`: 206.768 runs / 0 ticks (no migrado) → sin arranque
 *     que juzgar.
 */
describe('RULE_CRON_STARTED_NOT_FINISHED', () => {
  let svc: CronScheduleService;
  let registry: { getCronJobs: jest.Mock };
  let ctx: AlertRuleContext;

  const NOW = new Date('2026-07-27T09:00:00.000Z');
  const HOUR = 3600_000;

  beforeEach(async () => {
    registry = { getCronJobs: jest.fn().mockReturnValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronScheduleService,
        { provide: SchedulerRegistry, useValue: registry },
        // Sin jobs externos: estos tests hablan solo de @Cron in-process.
        { provide: EXTERNAL_SCHEDULED_JOBS_TOKEN, useValue: [] },
      ],
    }).compile();
    svc = moduleRef.get(CronScheduleService);
    ctx = { cronSchedule: svc };
  });

  afterEach(() => jest.useRealTimers());

  function setCrons(crons: Record<string, string>) {
    const map = new Map<string, CronJob>();
    for (const [name, expr] of Object.entries(crons)) {
      map.set(name, new CronJob(expr, () => {}, undefined, false, 'UTC'));
    }
    registry.getCronJobs.mockReturnValue(map);
  }

  /** Cron diario a las 09:30 UTC, como `detect-notas-convocatoria`. */
  const DAILY = { 'detect-notas-convocatoria': '30 9 * * *' };

  function row(over: Partial<StalledCronRow> = {}): StalledCronRow {
    return {
      endpoint: 'detect-notas-convocatoria',
      ticks: 30,
      runs: 17,
      lastTick: new Date(NOW.getTime() - 20 * HOUR),
      lastRun: new Date(NOW.getTime() - 3 * 24 * HOUR),
      p90DurationMs: 21_113_384, // 5,9 h — el p90 real del sistema viejo
      ...over,
    };
  }

  describe('el caso que origina la regla', () => {
    it('dispara cuando el cron arrancó y nunca emitió su completado', () => {
      setCrons(DAILY);
      const stalled = findStalledCrons([row()], ctx, NOW);
      expect(stalled).toHaveLength(1);
      expect(stalled[0].name).toBe('detect-notas-convocatoria');
      expect(stalled[0].lastRun).not.toBeNull();
      // 20 h parado contra un umbral de 3 × 5,9 h = 17,6 h.
      expect(stalled[0].stalledForMs).toBe(20 * HOUR);
      expect(Math.round(stalled[0].thresholdMs / HOUR)).toBe(18);
    });

    it('NO dispara si el completado es posterior al arranque (sano)', () => {
      setCrons(DAILY);
      const sano = row({
        lastRun: new Date(NOW.getTime() - 20 * HOUR + 1_209_395),
      });
      expect(findStalledCrons([sano], ctx, NOW)).toHaveLength(0);
    });

    it('NO dispara mientras el job aún puede estar corriendo', () => {
      setCrons(DAILY);
      const recien = row({ lastTick: new Date(NOW.getTime() - 2 * HOUR) });
      expect(findStalledCrons([recien], ctx, NOW)).toHaveLength(0);
    });

    it('un tick ANTERIOR al arranque del proceso SÍ dispara — es la firma del fallo', () => {
      // Contraste deliberado con `cron_overdue`, que desde el 27/07 ignora los
      // ticks previos al arranque. Ese es justo el hueco que esta regla recoge:
      // el reinicio se llevó por delante la ejecución en curso.
      setCrons(DAILY);
      const ctxConArranque: AlertRuleContext = {
        cronSchedule: svc,
        processStartedAtMs: NOW.getTime() - 2 * HOUR,
      };
      expect(findStalledCrons([row()], ctxConArranque, NOW)).toHaveLength(1);
    });
  });

  describe('crons que callan en éxito a propósito (la guarda que evita el ruido)', () => {
    it.each([
      ['served-coverage', 20, 0],
      ['trigger-renewal-reminders', 20, 0],
      ['law-completeness-sweep', 2, 0],
    ])('NO vigila %s (%i ticks / %i runs)', (endpoint, ticks, runs) => {
      setCrons({ [endpoint]: '0 5 * * *' });
      const r = row({
        endpoint,
        ticks,
        runs,
        lastRun: null,
        p90DurationMs: null,
      });
      expect(findStalledCrons([r], ctx, NOW)).toHaveLength(0);
    });

    it('NO vigila pool-capacity-sampler: 1 run en 43.308 ticks es "emite sólo al fallar"', () => {
      // Contraprueba del listón: con MIN_RUNS_BASELINE=1 este cron —que tickea
      // cada minuto— dispararía de forma permanente.
      setCrons({ 'pool-capacity-sampler': '* * * * *' });
      const r = row({
        endpoint: 'pool-capacity-sampler',
        ticks: 43_308,
        runs: 1,
        lastTick: new Date(NOW.getTime() - 5 * HOUR),
        lastRun: new Date(NOW.getTime() - 20 * 24 * HOUR),
        p90DurationMs: 50,
      });
      expect(findStalledCrons([r], ctx, NOW)).toHaveLength(0);
    });

    it('con 3 runs YA es juzgable — el listón separa, no exime para siempre', () => {
      setCrons({ 'algun-cron': '0 5 * * *' });
      const r = row({
        endpoint: 'algun-cron',
        ticks: 30,
        runs: 3,
        p90DurationMs: 1000,
      });
      expect(findStalledCrons([r], ctx, NOW)).toHaveLength(1);
    });
  });

  describe('exclusiones estructurales', () => {
    it('ignora un endpoint que no es un @Cron vivo (cron retirado)', () => {
      setCrons({ 'otro-cron': '0 5 * * *' });
      expect(findStalledCrons([row()], ctx, NOW)).toHaveLength(0);
    });

    it('ignora un cron sin cron_tick (no migrado, p.ej. outbox-processor)', () => {
      setCrons({ 'outbox-processor': '* * * * *' });
      const r = row({
        endpoint: 'outbox-processor',
        ticks: 0,
        runs: 206_768,
        lastTick: null,
        p90DurationMs: 40,
      });
      expect(findStalledCrons([r], ctx, NOW)).toHaveLength(0);
    });
  });

  describe('stallThresholdMs', () => {
    const DAY = 24 * HOUR;

    it('escala con la duración real: 3 × p90', () => {
      expect(stallThresholdMs(2 * HOUR, DAY)).toBe(6 * HOUR);
    });

    it('nunca baja de 15 min, aunque el cron dure milisegundos', () => {
      expect(stallThresholdMs(4000, HOUR)).toBe(15 * 60_000);
      expect(stallThresholdMs(null, HOUR)).toBe(15 * 60_000);
    });

    it('nunca supera el 90% del intervalo: el aviso llega ANTES del siguiente tick', () => {
      // p90 de 5,9 h × 3 = 17,6 h < 21,6 h (tope diario) → manda la duración.
      expect(stallThresholdMs(21_113_384, DAY)).toBeLessThan(0.9 * DAY);
      // Un cron horario que tardase 40 min quedaría capado a 54 min.
      expect(stallThresholdMs(40 * 60_000, HOUR)).toBe(0.9 * HOUR);
    });

    it('se auto-afina cuando el cron se vuelve rápido (6 h → 20 min)', () => {
      // El mismo cron con el p90 del sistema nuevo avisa a la hora, no a las 18.
      expect(stallThresholdMs(1_209_395, DAY)).toBeCloseTo(3_628_185, -3);
    });
  });

  describe('regla completa', () => {
    it('lanza si recibe ctx undefined (invariante del caller)', () => {
      expect(() => RULE_CRON_STARTED_NOT_FINISHED.shouldFire([row()])).toThrow(
        /requiere AlertRuleContext/,
      );
    });

    it('no dispara con el banco sano — 0 falsos positivos el día de encenderla', () => {
      // Reproduce la simulación bank-wide del 27/07: todos sanos o excluidos.
      setCrons({ ...DAILY, 'served-coverage': '0 5 * * *' });
      const rows = [
        row({ lastRun: new Date(NOW.getTime() - 20 * HOUR + 1_209_395) }),
        row({ endpoint: 'served-coverage', ticks: 20, runs: 0, lastRun: null }),
      ];
      expect(RULE_CRON_STARTED_NOT_FINISHED.shouldFire(rows, ctx)).toBe(false);
    });

    it('la notificación nombra el cron, cuánto lleva y su umbral', () => {
      setCrons(DAILY);
      const n = RULE_CRON_STARTED_NOT_FINISHED.buildNotification([row()], ctx);
      expect(n.title).toContain('1 cron arrancó y no terminó');
      expect(n.body).toContain('detect-notas-convocatoria');
      expect(n.body).toContain('se reinició');
      expect(n.metadata?.stalledCrons).toEqual(['detect-notas-convocatoria']);
      expect(n.fingerprint).toContain('detect-notas-convocatoria');
    });

    it('ordena por gravedad: el que más lleva parado, primero', () => {
      setCrons({ ...DAILY, 'detect-oep-llm': '0 10 * * 1-5' });
      const rows = [
        row({
          endpoint: 'detect-oep-llm',
          ticks: 21,
          runs: 13,
          lastTick: new Date(NOW.getTime() - 18 * HOUR),
          p90DurationMs: 9_476_000,
        }),
        row(),
      ];
      const stalled = findStalledCrons(rows, ctx, NOW);
      expect(stalled.map((s) => s.name)).toEqual([
        'detect-notas-convocatoria',
        'detect-oep-llm',
      ]);
    });
  });
});
