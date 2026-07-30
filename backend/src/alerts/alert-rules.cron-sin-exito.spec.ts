import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import {
  CronScheduleService,
  EXTERNAL_SCHEDULED_JOBS_TOKEN,
} from '../cron-schedule/cron-schedule.service';
import {
  RULE_CRON_SIN_EXITO,
  findCronsSinExito,
  sinExitoThresholdMs,
  type AlertRuleContext,
  type CronSinExitoRow,
} from './alert-rules';

/**
 * Tests de `cron_sin_exito` (T-307) — la cuarta pregunta sobre un cron, y la que
 * faltaba: `cron_overdue` mira si DISPARÓ, `cron_started_not_finished` si TERMINÓ,
 * `cron_failure_burst` si falla EN RÁFAGA… y nadie miraba si simplemente **corre y
 * falla todos los días**.
 *
 * Los datos NO son inventados: son los de `content-health-sweep` medidos el 30/07/2026
 * en `observable_events`, el caso que destapa el hueco.
 *
 *   28/07 05:01 UTC → cron_run info  (success, 393 hallazgos)
 *   29/07 07:31 UTC → cron_run error (statement_timeout, 78 s)
 *   30/07 07:31 UTC → cron_run error (statement_timeout, 80 s)
 *
 * Dos días fallando, cero alertas: `cron_failure_burst` exige 3 fallos en 1 hora y un
 * cron diario solo puede dar 1. Mientras tanto el panel enseñaba el snapshot del 28
 * como si fuera de hoy.
 */
describe('RULE_CRON_SIN_EXITO', () => {
  let svc: CronScheduleService;
  let registry: { getCronJobs: jest.Mock };
  let ctx: AlertRuleContext;

  const NOW = new Date('2026-07-30T09:00:00.000Z');
  const HOUR = 3600_000;
  const DIA = 24 * HOUR;

  beforeEach(async () => {
    registry = { getCronJobs: jest.fn().mockReturnValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronScheduleService,
        { provide: SchedulerRegistry, useValue: registry },
        { provide: EXTERNAL_SCHEDULED_JOBS_TOKEN, useValue: [] },
      ],
    }).compile();
    svc = moduleRef.get(CronScheduleService);
    ctx = { cronSchedule: svc };
  });

  function setCrons(crons: Record<string, string>) {
    const map = new Map<string, CronJob>();
    for (const [name, expr] of Object.entries(crons)) {
      map.set(name, new CronJob(expr, () => {}, undefined, false, 'UTC'));
    }
    registry.getCronJobs.mockReturnValue(map);
  }

  /** El barrido de salud: diario, 07:30 UTC. */
  const SWEEP = { 'content-health-sweep': '30 7 * * *' };

  function row(over: Partial<CronSinExitoRow> = {}): CronSinExitoRow {
    return {
      endpoint: 'content-health-sweep',
      lastRun: new Date('2026-07-30T07:31:20.000Z'),
      lastRunFailed: true,
      lastSuccess: new Date('2026-07-28T05:01:30.000Z'),
      successes: 25, // corre a diario y normalmente termina bien
      ...over,
    };
  }

  describe('el caso que origina la regla (content-health-sweep, 29 y 30/07)', () => {
    it('dispara: último intento fallido y sin un solo éxito en dos días', () => {
      setCrons(SWEEP);
      const malos = findCronsSinExito([row()], ctx, NOW);
      expect(malos).toHaveLength(1);
      expect(malos[0].name).toBe('content-health-sweep');
      // Tolerancia = 2 ticks de un cron diario = 48 h; lleva ~52 h sin éxito.
      expect(Math.round(malos[0].thresholdMs / HOUR)).toBe(48);
      expect(Math.round((malos[0].sinExitoMs ?? 0) / HOUR)).toBe(52);
    });

    it('la regla se declara con el nombre y la severidad que consume el motor', () => {
      setCrons(SWEEP);
      expect(RULE_CRON_SIN_EXITO.name).toBe('cron_sin_exito');
      expect(RULE_CRON_SIN_EXITO.severity).toBe('error');
      expect(RULE_CRON_SIN_EXITO.shouldFire([row()], ctx)).toBe(true);
    });

    it('el email dice qué cron es, cuándo fue el último éxito y qué mirar', () => {
      setCrons(SWEEP);
      const n = RULE_CRON_SIN_EXITO.buildNotification([row()], ctx);
      expect(n.title).toContain('FALLANDO');
      expect(n.body).toContain('content-health-sweep');
      expect(n.body).toContain('2026-07-28T05:01:30.000Z');
      expect(n.body).toContain('EXPLAIN');
      expect(n.fingerprint).toBe('cron_sin_exito_content-health-sweep');
    });
  });

  describe('lo que NO debe disparar (que es donde se rompen estas reglas)', () => {
    it('un fallo AISLADO que ya se recuperó: el último run fue bueno', () => {
      setCrons(SWEEP);
      const sano = row({
        lastRunFailed: false,
        lastSuccess: new Date(NOW.getTime() - 90 * 60_000),
      });
      expect(findCronsSinExito([sano], ctx, NOW)).toHaveLength(0);
    });

    it('un fallo de ANOCHE con éxito dentro de la tolerancia (aún no son dos ticks)', () => {
      setCrons(SWEEP);
      const reciente = row({ lastSuccess: new Date(NOW.getTime() - 25 * HOUR) });
      expect(findCronsSinExito([reciente], ctx, NOW)).toHaveLength(0);
    });

    it('un cron que SOLO emite `cron_run` al fallar (pool-capacity-sampler)', () => {
      // Medido: 1 run en 43.308 ticks. "Último run fallido y ningún éxito" es su
      // estado sano; sin la guarda de éxitos, esta regla nacería disparando contra
      // él para siempre. Es el mismo caso que calibró `cron_started_not_finished`.
      setCrons({ 'pool-capacity-sampler': '* * * * *' });
      const soloFallos: CronSinExitoRow = {
        endpoint: 'pool-capacity-sampler',
        lastRun: new Date(NOW.getTime() - 10 * 60_000),
        lastRunFailed: true,
        lastSuccess: null,
        successes: 0,
      };
      expect(findCronsSinExito([soloFallos], ctx, NOW)).toHaveLength(0);
    });

    it('un cron RETIRADO que ya no está en el registro (no alerta para siempre)', () => {
      setCrons({}); // el registro no lo conoce
      expect(findCronsSinExito([row()], ctx, NOW)).toHaveLength(0);
    });

    it('un cron por minuto con dos fallos seguidos: el suelo de 90 min lo protege', () => {
      setCrons({ 'canary-answer-save': '* * * * *' });
      const porMinuto: CronSinExitoRow = {
        endpoint: 'canary-answer-save',
        lastRun: new Date(NOW.getTime() - 60_000),
        lastRunFailed: true,
        lastSuccess: new Date(NOW.getTime() - 3 * 60_000),
        successes: 5000,
      };
      expect(findCronsSinExito([porMinuto], ctx, NOW)).toHaveLength(0);
      // …pero si lleva dos horas sin un solo éxito, sí:
      const roto = {
        ...porMinuto,
        lastSuccess: new Date(NOW.getTime() - 2 * HOUR),
      };
      expect(findCronsSinExito([roto], ctx, NOW)).toHaveLength(1);
    });
  });

  describe('la tolerancia se deriva del intervalo, no es un número fijo', () => {
    it('un cron diario tolera 48 h; uno de 5 min, el suelo de 90 min', () => {
      expect(sinExitoThresholdMs(DIA)).toBe(2 * DIA);
      expect(sinExitoThresholdMs(5 * 60_000)).toBe(90 * 60_000);
      // Un semanal tolera dos semanas: sin esto, un cron semanal alertaría por su
      // primer fallo (el mismo error que generó el falso positivo de junio).
      expect(sinExitoThresholdMs(7 * DIA)).toBe(14 * DIA);
    });

    it('sin NINGÚN éxito en los 30 días consultados, se juzga por el fallo confirmado', () => {
      setCrons(SWEEP);
      const nunca = row({ lastSuccess: null, successes: 4 });
      const malos = findCronsSinExito([nunca], ctx, NOW);
      expect(malos).toHaveLength(1);
      expect(malos[0].sinExitoMs).toBeNull();
    });
  });
});
