import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronJob } from 'cron';
import { CronScheduleService } from './cron-schedule.service';

describe('CronScheduleService', () => {
  let svc: CronScheduleService;
  let registry: { getCronJobs: jest.Mock };

  beforeEach(async () => {
    registry = { getCronJobs: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronScheduleService,
        { provide: SchedulerRegistry, useValue: registry },
      ],
    }).compile();
    svc = moduleRef.get(CronScheduleService);
  });

  function setCrons(
    crons: Array<{ name: string; expression: string; tz?: string }>,
  ) {
    const map = new Map<string, CronJob>();
    for (const c of crons) {
      map.set(
        c.name,
        new CronJob(c.expression, () => {}, undefined, false, c.tz ?? 'UTC'),
      );
    }
    registry.getCronJobs.mockReturnValue(map);
  }

  it('resuelve prev/next ticks para cron Mon-Fri en domingo UTC', () => {
    setCrons([{ name: 'detect-oep-llm', expression: '0 10 * * 1-5' }]);
    const now = new Date('2026-05-31T11:00:00Z'); // domingo
    const jobs = svc.listCronJobs(now);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: 'detect-oep-llm',
      expression: '0 10 * * 1-5',
      timeZone: 'UTC',
    });
    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-05-29T10:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-06-01T10:00:00.000Z',
    );
  });

  it('resuelve prev/next ticks para cron every-5min', () => {
    setCrons([{ name: 'refresh-rankings', expression: '*/5 * * * *' }]);
    const now = new Date('2026-05-31T11:02:34Z');
    const jobs = svc.listCronJobs(now);

    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-05-31T11:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-05-31T11:05:00.000Z',
    );
  });

  it('lunes 09:00 con cron L-V (0 10 * * 1-5): prev = viernes 10:00 (el tick de hoy aún no llegó)', () => {
    setCrons([{ name: 'detect-oep-llm', expression: '0 10 * * 1-5' }]);
    const now = new Date('2026-06-01T09:00:00Z');
    const jobs = svc.listCronJobs(now);

    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-05-29T10:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-06-01T10:00:00.000Z',
    );
  });

  it('lunes 11:00 con cron L-V (0 10 * * 1-5): prev = lunes 10:00 (el tick de hoy ya pasó)', () => {
    setCrons([{ name: 'detect-oep-llm', expression: '0 10 * * 1-5' }]);
    const now = new Date('2026-06-01T11:00:00Z');
    const jobs = svc.listCronJobs(now);

    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-06-01T10:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-06-02T10:00:00.000Z',
    );
  });

  it('respeta timeZone declarado en el cron job', () => {
    setCrons([
      { name: 'madrid-cron', expression: '0 10 * * *', tz: 'Europe/Madrid' },
    ]);
    const now = new Date('2026-05-31T11:00:00Z'); // = 13:00 Madrid (CEST)
    const jobs = svc.listCronJobs(now);

    expect(jobs[0].timeZone).toBe('Europe/Madrid');
    // 10:00 Madrid hoy = 08:00 UTC (CEST = UTC+2); ya pasó.
    expect(jobs[0].prevExpectedTick.toISOString()).toBe(
      '2026-05-31T08:00:00.000Z',
    );
    expect(jobs[0].nextExpectedTick.toISOString()).toBe(
      '2026-06-01T08:00:00.000Z',
    );
  });

  it('devuelve uno por cada @Cron registrado', () => {
    setCrons([
      { name: 'a', expression: '*/5 * * * *' },
      { name: 'b', expression: '0 9 * * 1-5' },
      { name: 'c', expression: '0 4 * * 0' },
    ]);
    const jobs = svc.listCronJobs(new Date('2026-05-31T11:00:00Z'));
    expect(jobs.map((j) => j.name).sort()).toEqual(['a', 'b', 'c']);
  });

  it('omite (sin lanzar) jobs cuya cronTime.source no es expresión string', () => {
    // CronJob admite Date concreta como schedule. No tiene calendario que vigilar.
    const dynamic = new CronJob(
      new Date('2099-01-01T00:00:00Z'),
      () => {},
      undefined,
      false,
      'UTC',
    );
    registry.getCronJobs.mockReturnValue(
      new Map<string, CronJob>([['dynamic', dynamic]]),
    );

    const jobs = svc.listCronJobs(new Date('2026-05-31T11:00:00Z'));
    expect(jobs).toEqual([]);
  });

  it('default currentDate = new Date() si no se pasa (clock real / fake)', () => {
    // Fijamos el reloj en un instante NO alineado con el tick para evitar
    // la ambigüedad de cron-parser en `currentDate == tick exacto`
    // (devuelve el tick anterior estricto en ese caso).
    jest.useFakeTimers().setSystemTime(new Date('2026-05-31T11:02:00Z'));
    try {
      setCrons([{ name: 'refresh-rankings', expression: '*/5 * * * *' }]);
      const jobs = svc.listCronJobs();
      expect(jobs[0].prevExpectedTick.toISOString()).toBe(
        '2026-05-31T11:00:00.000Z',
      );
      expect(jobs[0].nextExpectedTick.toISOString()).toBe(
        '2026-05-31T11:05:00.000Z',
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
