import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import { CronScheduleService } from '../cron-schedule/cron-schedule.service';
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
    expect(notif.metadata).toEqual({ overdueCrons: ['detect-oep-llm'] });
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
