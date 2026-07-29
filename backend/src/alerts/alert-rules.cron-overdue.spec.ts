import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import {
  CronScheduleService,
  EXTERNAL_SCHEDULED_JOBS_TOKEN,
} from '../cron-schedule/cron-schedule.service';
import { RULE_CRON_OVERDUE, type AlertRuleContext } from './alert-rules';

/**
 * Tests del nuevo RULE_CRON_OVERDUE — basado en SchedulerRegistry como
 * fuente única de verdad del schedule, en vez del mapa hardcoded previo.
 *
 * Escenarios cubiertos (todos con tiempo congelado vía `jest.useFakeTimers`):
 *
 *   - Calendarios L-V en fin de semana (último viernes vs ejecuciones antiguas)
 *   - Lunes en horario pre/post-tick (tick aún no debido vs ya pasado)
 *   - Crons cada 5 min con tick recién emitido y con tick perdido
 *   - Cron nunca observado durante bootstrap (silencio) vs roto >24h (overdue)
 *   - Endpoints sin @Cron asociado (fuera de la vigilancia)
 *   - Invariante: la regla lanza si recibe ctx undefined
 *   - Contenido de la notificación
 */
describe('RULE_CRON_OVERDUE', () => {
  let svc: CronScheduleService;
  let registry: { getCronJobs: jest.Mock };
  let ctx: AlertRuleContext;

  beforeEach(async () => {
    registry = { getCronJobs: jest.fn().mockReturnValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronScheduleService,
        { provide: SchedulerRegistry, useValue: registry },
        // Sin jobs externos: estos tests hablan solo de @Cron in-process. El
        // catálogo real se prueba aparte (external-jobs.spec.ts) — inyectarlo
        // aquí haría que añadir un job a producción rompiera tests ajenos.
        { provide: EXTERNAL_SCHEDULED_JOBS_TOKEN, useValue: [] },
      ],
    }).compile();
    svc = moduleRef.get(CronScheduleService);
    ctx = { cronSchedule: svc };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setCrons(crons: Record<string, string>) {
    const map = new Map<string, CronJob>();
    for (const [name, expr] of Object.entries(crons)) {
      map.set(name, new CronJob(expr, () => {}, undefined, false, 'UTC'));
    }
    registry.getCronJobs.mockReturnValue(map);
  }

  function freeze(iso: string) {
    jest.useFakeTimers().setSystemTime(new Date(iso));
  }

  // ── Calendario Mon-Fri ───────────────────────────────────────────

  it('domingo 11:00 UTC + cron L-V que tickeó el viernes → NO overdue', () => {
    freeze('2026-05-31T11:00:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-29T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  it('domingo 11:00 UTC + cron L-V que perdió jueves Y viernes → SÍ overdue (caso real 31/05/2026)', () => {
    freeze('2026-05-31T11:00:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-27T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  // ── Borde del tick en el día de ejecución ─────────────────────────

  it('lunes 09:00 UTC + cron 10:00 L-V que tickeó viernes → NO overdue (el tick de hoy aún no llegó)', () => {
    freeze('2026-06-01T09:00:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-29T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  it('lunes 10:30 UTC + cron 10:00 L-V que tickeó hoy 10:00:15 → NO overdue (dentro de grace)', () => {
    freeze('2026-06-01T10:30:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-06-01T10:00:15Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  it('lunes 11:00 UTC + cron 10:00 L-V que NO tickeó hoy → SÍ overdue', () => {
    freeze('2026-06-01T11:00:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-29T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  // ── every-5min ───────────────────────────────────────────────────

  it('every-5min + tick reciente (hace 4min, dentro de grace 30min) → NO overdue', () => {
    freeze('2026-05-31T11:04:30Z');
    setCrons({ 'refresh-rankings': '*/5 * * * *' });
    const rows = [
      { endpoint: 'refresh-rankings', lastTs: '2026-05-31T11:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  it('every-5min + último tick hace 90min → SÍ overdue', () => {
    freeze('2026-05-31T11:30:00Z');
    setCrons({ 'refresh-rankings': '*/5 * * * *' });
    const rows = [
      { endpoint: 'refresh-rankings', lastTs: '2026-05-31T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  // ── Crons nunca observados ───────────────────────────────────────

  it('cron registrado pero sin observación previa, primer tick hace 30min → silencio (bootstrap)', () => {
    freeze('2026-05-31T11:30:00Z');
    // '0 11 * * *' → prev = hoy 11:00, hace 30 min (< 60min grace bootstrap)
    setCrons({ 'new-cron': '0 11 * * *' });
    const rows: Array<{ endpoint: string; lastTs: string | null }> = [];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  it('cron registrado pero sin observación previa, primer tick hace >24h → SÍ overdue', () => {
    freeze('2026-05-31T11:30:00Z');
    // '0 10 * * *' → prev = ayer 10:00, hace 25.5h
    setCrons({ 'broken-cron': '0 10 * * *' });
    const rows: Array<{ endpoint: string; lastTs: string | null }> = [];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  // ── Cron recién desplegado: tick esperado ANTES del arranque ─────

  it('cron RECIÉN DESPLEGADO (proceso arrancó tras su último tick) → NO overdue (fix migración)', () => {
    freeze('2026-05-31T20:00:00Z');
    // '0 4 * * *' → prev = hoy 04:00. El proceso arrancó a las 18:00 (después),
    // así que el cron no pudo dispararse en ese tick → falso positivo evitado.
    setCrons({ 'trigger-check-stats-drift': '0 4 * * *' });
    const rows: Array<{ endpoint: string; lastTs: string | null }> = [];
    const ctxDeployed: AlertRuleContext = {
      cronSchedule: svc,
      processStartedAtMs: new Date('2026-05-31T18:00:00Z').getTime(),
    };
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctxDeployed)).toBe(false);
  });

  it('cron nunca observado con proceso vivo DESDE ANTES de su tick → SÍ overdue (roto real, no migración)', () => {
    freeze('2026-05-31T20:00:00Z');
    // '0 4 * * *' → prev = hoy 04:00. El proceso lleva vivo desde ayer, así que
    // el cron SÍ debió dispararse a las 04:00 y no lo hizo → overdue legítimo.
    setCrons({ 'trigger-check-stats-drift': '0 4 * * *' });
    const rows: Array<{ endpoint: string; lastTs: string | null }> = [];
    const ctxOld: AlertRuleContext = {
      cronSchedule: svc,
      processStartedAtMs: new Date('2026-05-30T00:00:00Z').getTime(),
    };
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctxOld)).toBe(true);
  });

  // ── Cron RETIRADO y REACTIVADO: lastRun viejo, ticks de cuando estaba apagado ──

  it('cron REACTIVADO (ejecuciones viejas de antes de apagarlo, tick previo ANTES del arranque) → NO overdue', () => {
    // Caso real 27/07: `check-seguimiento` (L-V 09:00) se retiró el lun 20/07 —su
    // último tick real— y se reactivó el dom 26/07 a las 21:03. El lunes 27 a las
    // 06:25 su tick previo es el vie 24 09:00, de cuando estaba APAGADO, y su
    // primer tick legítimo (hoy 09:00) aún no ha llegado. No es un cron roto.
    freeze('2026-07-27T06:25:00Z');
    setCrons({ 'check-seguimiento': '0 9 * * 1-5' });
    const rows = [
      { endpoint: 'check-seguimiento', lastTs: '2026-07-20T09:00:00Z' },
    ];
    const ctxReactivated: AlertRuleContext = {
      cronSchedule: svc,
      processStartedAtMs: new Date('2026-07-26T21:03:00Z').getTime(),
    };
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctxReactivated)).toBe(false);
  });

  it('mismo cron con ejecuciones viejas pero tick previo YA con el proceso vivo → SÍ overdue', () => {
    // Contraprueba: el martes 28 a las 10:00 el tick previo (28 09:00) ocurrió
    // estando el proceso vivo desde el 26. Si no emitió, está roto de verdad y
    // el guard NO debe taparlo.
    freeze('2026-07-28T10:00:00Z');
    setCrons({ 'check-seguimiento': '0 9 * * 1-5' });
    const rows = [
      { endpoint: 'check-seguimiento', lastTs: '2026-07-20T09:00:00Z' },
    ];
    const ctxAlive: AlertRuleContext = {
      cronSchedule: svc,
      processStartedAtMs: new Date('2026-07-26T21:03:00Z').getTime(),
    };
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctxAlive)).toBe(true);
  });

  it('sin processStartedAtMs (tests/legacy) el guard no aplica → sigue detectando el roto', () => {
    freeze('2026-07-27T06:25:00Z');
    setCrons({ 'check-seguimiento': '0 9 * * 1-5' });
    const rows = [
      { endpoint: 'check-seguimiento', lastTs: '2026-07-20T09:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  // ── Endpoint legacy fuera del SchedulerRegistry ──────────────────

  it('endpoint observado pero sin @Cron asociado → fuera de la vigilancia', () => {
    freeze('2026-05-31T11:00:00Z');
    setCrons({});
    const rows = [
      { endpoint: '/api/cron/legacy-endpoint', lastTs: '2026-05-25T10:00:00Z' },
    ];
    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  // ── Invariante de ctx ────────────────────────────────────────────

  it('lanza si ctx no se pasa — invariante explícito, no fallo silencioso', () => {
    expect(() => RULE_CRON_OVERDUE.shouldFire([], undefined)).toThrow(
      /AlertRuleContext/,
    );
    expect(() => RULE_CRON_OVERDUE.buildNotification([], undefined)).toThrow(
      /AlertRuleContext/,
    );
  });

  // ── Notification payload ─────────────────────────────────────────

  it('buildNotification incluye expresión, timezone, prev/next y last actual', () => {
    freeze('2026-05-31T11:00:00Z');
    setCrons({ 'detect-oep-llm': '0 10 * * 1-5' });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-27T10:00:00Z' },
    ];
    const notif = RULE_CRON_OVERDUE.buildNotification(rows, ctx);

    expect(notif.title).toBe('1 cron overdue');
    expect(notif.body).toContain("'0 10 * * 1-5'");
    expect(notif.body).toContain('UTC');
    expect(notif.body).toContain('2026-05-29T10:00:00.000Z'); // prev expected
    expect(notif.body).toContain('2026-05-27T10:00:00.000Z'); // último real
    expect(notif.body).toContain('2026-06-01T10:00:00.000Z'); // próximo
    expect(notif.metadata).toEqual({
      overdueCrons: ['detect-oep-llm'],
      // Un @Cron de este proceso NUNCA se reporta como externo: el email manda
      // a mirar los logs del backend, no el arranque de un contenedor ajeno.
      externalOverdue: [],
    });
  });

  it('buildNotification pluraliza con N>1', () => {
    freeze('2026-05-31T11:00:00Z');
    setCrons({
      'detect-oep-llm': '0 10 * * 1-5',
      'detect-generic-sources': '0 8 * * 1-5',
    });
    const rows = [
      { endpoint: 'detect-oep-llm', lastTs: '2026-05-27T10:00:00Z' },
      { endpoint: 'detect-generic-sources', lastTs: '2026-05-27T08:00:00Z' },
    ];
    const notif = RULE_CRON_OVERDUE.buildNotification(rows, ctx);
    expect(notif.title).toBe('2 crons overdue');
    expect(notif.metadata?.overdueCrons).toEqual(
      expect.arrayContaining(['detect-oep-llm', 'detect-generic-sources']),
    );
  });

  // ── Cadencia POR INTERVALO (jobs externos tipo `rate(30 minutes)`) ──
  //
  // Regresión del 29/07/2026: `temario-pdf-worker` se declaró `*/30 * * * *`
  // (fase :00/:30) cuando su scheduler es `rate(30 minutes)`, sin fase. Sus
  // ticks reales caían a :20 y :50 y la regla —que comparaba contra el tick de
  // calendario menos un margen de 6 min— lo marcaba overdue en CADA ventana:
  // 4 CRITICAL en un día contra un worker que estaba drenando la cola sin un
  // solo fallo. Estos tests fijan el criterio correcto: para una cadencia sin
  // fase se mide el SILENCIO desde el último tick, no la hora de reloj.
  describe('jobs de cadencia por intervalo', () => {
    /** Monta el servicio con un job externo de intervalo y sin @Cron locales. */
    async function conJobDeIntervalo(everyMinutes: number) {
      const moduleRef = await Test.createTestingModule({
        providers: [
          CronScheduleService,
          { provide: SchedulerRegistry, useValue: registry },
          {
            provide: EXTERNAL_SCHEDULED_JOBS_TOKEN,
            useValue: [
              {
                name: 'temario-pdf-worker',
                cadence: 'interval',
                everyMinutes,
                runner: 'ECS scheduled task (EventBridge, rate(30 minutes))',
                why: 'render CPU-bound fuera del serving',
              },
            ],
          },
        ],
      }).compile();
      return {
        cronSchedule: moduleRef.get(CronScheduleService),
      } as AlertRuleContext;
    }

    it('EL CASO REAL: ticks puntuales a :20/:50 con fase declarada en :00/:30 → NO overdue', async () => {
      // Instantes tomados de observable_events el 29/07: la alerta disparó a
      // las 05:40 teniendo un tick sano de las 05:20.
      freeze('2026-07-29T05:40:00Z');
      const c = await conJobDeIntervalo(30);
      const rows = [
        { endpoint: 'temario-pdf-worker', lastTs: '2026-07-29T05:20:00Z' },
      ];
      expect(RULE_CRON_OVERDUE.shouldFire(rows, c)).toBe(false);
    });

    it('silencio dentro del periodo + margen (35min de 30+6) → NO overdue', async () => {
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      const rows = [
        { endpoint: 'temario-pdf-worker', lastTs: '2026-07-29T05:25:00Z' },
      ];
      expect(RULE_CRON_OVERDUE.shouldFire(rows, c)).toBe(false);
    });

    it('silencio mayor que el periodo + margen (40min) → SÍ overdue', async () => {
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      const rows = [
        { endpoint: 'temario-pdf-worker', lastTs: '2026-07-29T05:20:00Z' },
      ];
      expect(RULE_CRON_OVERDUE.shouldFire(rows, c)).toBe(true);
    });

    it('EL INCIDENTE QUE ABRIÓ EL CATÁLOGO: 2 días sin una sola señal → SÍ overdue', async () => {
      // La imagen del worker fue purgada de ECR y el contenedor moría en el
      // pull, sin emitir nada. La ausencia de señal es la única prueba posible.
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      const rows = [
        { endpoint: 'temario-pdf-worker', lastTs: '2026-07-27T06:00:00Z' },
      ];
      expect(RULE_CRON_OVERDUE.shouldFire(rows, c)).toBe(true);
    });

    it('sin señal en 60d y proceso recién arrancado → silencio (job recién catalogado)', async () => {
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      c.processStartedAtMs = new Date('2026-07-29T05:30:00Z').getTime();
      expect(RULE_CRON_OVERDUE.shouldFire([], c)).toBe(false);
    });

    it('sin señal en 60d y proceso vivo desde hace rato → SÍ overdue', async () => {
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      c.processStartedAtMs = new Date('2026-07-28T06:00:00Z').getTime();
      expect(RULE_CRON_OVERDUE.shouldFire([], c)).toBe(true);
    });

    it('el email no inventa una hora de reloj que el job no promete', async () => {
      freeze('2026-07-29T06:00:00Z');
      const c = await conJobDeIntervalo(30);
      const rows = [
        { endpoint: 'temario-pdf-worker', lastTs: '2026-07-29T05:00:00Z' },
      ];
      const notif = RULE_CRON_OVERDUE.buildNotification(rows, c);
      expect(notif.body).toContain('cada 30 min');
      expect(notif.body).toContain('hace 60min');
      // «esperado: <hora>» mandaría a buscar un tick de calendario inexistente.
      expect(notif.body).not.toContain('esperado:');
      expect(notif.metadata?.externalOverdue).toEqual(['temario-pdf-worker']);
    });
  });

  it('la query lee la señal de ARRANQUE cron_tick (no solo el cron_run de completado)', () => {
    // Anti-regresión del fix 2026-06-12: medir liveness por el arranque del
    // tick, no por el completado — si no, un cron lento (escaneo LLM) falsea
    // overdue durante toda su ejecución. Ver runWithHeartbeat + CronTickOpts.
    const chunks = (
      RULE_CRON_OVERDUE.query as unknown as {
        queryChunks: Array<{ value?: unknown }>;
      }
    ).queryChunks;
    const sqlText = chunks
      .map((c) => (Array.isArray(c.value) ? c.value.join('') : ''))
      .join('');
    expect(sqlText).toContain('cron_tick');
    expect(sqlText).toContain('cron_run');
  });
});
