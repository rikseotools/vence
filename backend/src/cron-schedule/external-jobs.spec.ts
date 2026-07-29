import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import {
  CronScheduleService,
  EXTERNAL_SCHEDULED_JOBS_TOKEN,
} from './cron-schedule.service';
import {
  EXTERNAL_SCHEDULED_JOBS,
  type ExternalScheduledJob,
} from './external-jobs.registry';
import { RULE_CRON_OVERDUE, type AlertRuleContext } from '../alerts/alert-rules';

/**
 * Jobs programados que corren FUERA de este proceso.
 *
 * Incidente que motiva todo esto (27→29/07/2026): `temario-pdf-worker` dejó de
 * ejecutarse porque su imagen fue purgada del registry — el contenedor moría en
 * el pull, ANTES del entrypoint, así que no emitía ni logs ni eventos. Estuvo 2
 * días muerto sin una sola alerta, porque `cron_overdue` solo enumeraba los
 * @Cron del `SchedulerRegistry` local. El único síntoma fue el canary de la cola
 * de PDFs quejándose de un backlog que envejecía, que señala al sitio
 * equivocado: la cola no estaba atascada, el consumidor no existía.
 *
 * La detección es AGNÓSTICA de proveedor a propósito: se compara la cadencia
 * declarada contra las señales que el job emite. Ni una llamada a la nube, así
 * que sobrevive intacta a un cambio de proveedor.
 */
describe('jobs programados externos', () => {
  let registry: { getCronJobs: jest.Mock };

  async function build(
    externalJobs: readonly ExternalScheduledJob[],
  ): Promise<CronScheduleService> {
    registry = { getCronJobs: jest.fn().mockReturnValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronScheduleService,
        { provide: SchedulerRegistry, useValue: registry },
        { provide: EXTERNAL_SCHEDULED_JOBS_TOKEN, useValue: externalJobs },
      ],
    }).compile();
    return moduleRef.get(CronScheduleService);
  }

  function setCrons(crons: Record<string, string>) {
    const map = new Map<string, CronJob>();
    for (const [name, expr] of Object.entries(crons)) {
      map.set(name, new CronJob(expr, () => {}, undefined, false, 'UTC'));
    }
    registry.getCronJobs.mockReturnValue(map);
  }

  const JOB: ExternalScheduledJob = {
    name: 'temario-pdf-worker',
    expression: '*/30 * * * *',
    timeZone: 'UTC',
    runner: 'contenedor programado',
    why: 'render pesado fuera del serving',
  };

  afterEach(() => jest.useRealTimers());

  // ── El catálogo entra en el calendario ────────────────────────────

  it('un job externo aparece en el calendario con origin=external', async () => {
    const svc = await build([JOB]);
    const jobs = svc.listCronJobs(new Date('2026-07-29T10:07:00Z'));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: 'temario-pdf-worker',
      origin: 'external',
      expression: '*/30 * * * *',
    });
    // La cadencia se resuelve igual que la de un @Cron: prev/next reales.
    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-07-29T10:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-07-29T10:30:00.000Z',
    );
  });

  it('los @Cron in-process se marcan origin=in-process y conviven con los externos', async () => {
    const svc = await build([JOB]);
    setCrons({ 'content-health-sweep': '30 7 * * *' });
    const jobs = svc.listCronJobs(new Date('2026-07-29T10:07:00Z'));

    expect(jobs.map((j) => [j.name, j.origin]).sort()).toEqual([
      ['content-health-sweep', 'in-process'],
      ['temario-pdf-worker', 'external'],
    ]);
  });

  it('si un nombre colisiona, gana el @Cron in-process (proceso vivo > declaración)', async () => {
    const svc = await build([{ ...JOB, name: 'content-health-sweep' }]);
    setCrons({ 'content-health-sweep': '30 7 * * *' });
    const jobs = svc.listCronJobs(new Date('2026-07-29T10:07:00Z'));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: 'content-health-sweep',
      origin: 'in-process',
      expression: '30 7 * * *',
    });
  });

  it('una expresión inválida se descarta sin tumbar el calendario', async () => {
    const svc = await build([{ ...JOB, expression: 'no-es-una-cadencia' }]);
    setCrons({ 'content-health-sweep': '30 7 * * *' });
    const jobs = svc.listCronJobs(new Date('2026-07-29T10:07:00Z'));

    expect(jobs.map((j) => j.name)).toEqual(['content-health-sweep']);
  });

  // ── El guard de arranque del proceso NO aplica a externos ─────────
  //
  // Es LA decisión de diseño de esta pieza. `cron_overdue` silencia un tick
  // anterior al arranque del proceso porque un @Cron no puede estar overdue por
  // un tick en el que este proceso no existía. Un job externo corre en su propio
  // contenedor: su vida no depende de nuestros reinicios. Si se le aplicara el
  // guard, cada despliegue del backend lo silenciaría de nuevo.

  it('job EXTERNO muerto antes del último arranque del backend → SÍ dispara', async () => {
    const svc = await build([JOB]);
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:07:00Z'));
    const ctx: AlertRuleContext = {
      cronSchedule: svc,
      // El backend se reinició hace 5 minutos (deploy). El tick esperado del
      // worker (10:00) es anterior a ese arranque.
      processStartedAtMs: new Date('2026-07-29T10:02:00Z').getTime(),
    };
    const rows = [
      { endpoint: 'temario-pdf-worker', lastTs: '2026-07-27T08:09:00Z' },
    ];

    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);
  });

  it('@Cron IN-PROCESS con tick anterior al arranque → NO dispara (comportamiento intacto)', async () => {
    const svc = await build([]);
    setCrons({ 'content-health-sweep': '*/30 * * * *' });
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:07:00Z'));
    const ctx: AlertRuleContext = {
      cronSchedule: svc,
      processStartedAtMs: new Date('2026-07-29T10:02:00Z').getTime(),
    };
    const rows = [
      { endpoint: 'content-health-sweep', lastTs: '2026-07-27T08:09:00Z' },
    ];

    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  // ── Simulación del incidente real ─────────────────────────────────

  it('SIMULACIÓN 27→29/07: worker con última señal el 27/07 08:09 y cadencia 30 min → overdue', async () => {
    const svc = await build([JOB]);
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T01:21:00Z'));
    const ctx: AlertRuleContext = { cronSchedule: svc };
    // Última señal real medida en prod antes de que la tarea dejara de arrancar.
    const rows = [
      { endpoint: 'temario-pdf-worker', lastTs: '2026-07-27T08:09:00Z' },
    ];

    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(true);

    const notif = RULE_CRON_OVERDUE.buildNotification(rows, ctx);
    expect(notif.metadata?.externalOverdue).toEqual(['temario-pdf-worker']);
    // El email tiene que mandar a mirar el arranque del contenedor: en este
    // fallo no hay logs que leer, la tarea muere antes del entrypoint.
    expect(notif.body).toContain('LLEGA A ARRANCAR');
    expect(notif.body).toContain('job EXTERNO');
  });

  it('SIMULACIÓN: el mismo worker drenando con normalidad NO dispara', async () => {
    const svc = await build([JOB]);
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T01:21:00Z'));
    const ctx: AlertRuleContext = { cronSchedule: svc };
    const rows = [
      { endpoint: 'temario-pdf-worker', lastTs: '2026-07-29T01:00:00Z' },
    ];

    expect(RULE_CRON_OVERDUE.shouldFire(rows, ctx)).toBe(false);
  });

  // ── Invariantes del catálogo de producción ────────────────────────

  describe('catálogo real', () => {
    it('toda entrada declara una cadencia cron parseable (no el dialecto del proveedor)', async () => {
      const svc = await build(EXTERNAL_SCHEDULED_JOBS);
      const jobs = svc.listCronJobs(new Date('2026-07-29T10:07:00Z'));
      // Si una expresión no parsea, `resolveTicks` la descarta y el job
      // desaparece del calendario — es decir, se vuelve invisible EN SILENCIO,
      // que es justo el fallo que estamos cerrando.
      expect(jobs).toHaveLength(EXTERNAL_SCHEDULED_JOBS.length);
    });

    it('ninguna cadencia usa rate()/dialecto de proveedor', () => {
      for (const job of EXTERNAL_SCHEDULED_JOBS) {
        expect(job.expression).not.toMatch(/rate\(|cron\(/i);
        expect(job.expression.trim().split(/\s+/)).toHaveLength(5);
      }
    });

    it('los nombres son únicos', () => {
      const names = EXTERNAL_SCHEDULED_JOBS.map((j) => j.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('toda entrada documenta dónde corre y por qué vive fuera del proceso', () => {
      for (const job of EXTERNAL_SCHEDULED_JOBS) {
        expect(job.runner.length).toBeGreaterThan(10);
        expect(job.why.length).toBeGreaterThan(20);
      }
    });
  });
});
