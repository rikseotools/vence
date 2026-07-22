import { SchedulerRegistry } from '@nestjs/schedule';
import { CheckSeguimientoCron } from './check-seguimiento.cron';

/**
 * Regresión del incidente 22/07: el @Cron de check-seguimiento se registra SIEMPRE en
 * `SchedulerRegistry` (el gate `isEnabled()` vive dentro de `handle()`), y `cron_overdue`
 * enumera ESE registro (no el heartbeat). Un cron retirado seguía marcándose overdue →
 * `[Vence CRITICAL] cron overdue` cada día laborable durante 60 días. El fix des-registra el
 * job en `onApplicationBootstrap` cuando el flag está OFF.
 */
describe('CheckSeguimientoCron — des-registro del SchedulerRegistry al estar retirado', () => {
  const OLD = process.env.CHECK_SEGUIMIENTO_ENABLED;

  function build() {
    const deleteCronJob = jest.fn();
    const registry = { deleteCronJob } as unknown as SchedulerRegistry;
    const cron = new CheckSeguimientoCron(
      { run: jest.fn() } as never,
      { emitFireAndForget: jest.fn() } as never,
      { register: jest.fn() } as never,
      registry,
    );
    return { cron, deleteCronJob };
  }

  afterEach(() => {
    if (OLD === undefined) delete process.env.CHECK_SEGUIMIENTO_ENABLED;
    else process.env.CHECK_SEGUIMIENTO_ENABLED = OLD;
  });

  it('retirado (flag OFF) → borra el job en onApplicationBootstrap', () => {
    delete process.env.CHECK_SEGUIMIENTO_ENABLED;
    const { cron, deleteCronJob } = build();
    cron.onApplicationBootstrap();
    expect(deleteCronJob).toHaveBeenCalledWith('check-seguimiento');
  });

  it('activo (flag ON) → NO toca el SchedulerRegistry', () => {
    process.env.CHECK_SEGUIMIENTO_ENABLED = 'true';
    const { cron, deleteCronJob } = build();
    cron.onApplicationBootstrap();
    expect(deleteCronJob).not.toHaveBeenCalled();
  });

  it('idempotente: si el job ya no está, deleteCronJob lanza y se traga sin romper', () => {
    delete process.env.CHECK_SEGUIMIENTO_ENABLED;
    const { cron, deleteCronJob } = build();
    deleteCronJob.mockImplementation(() => {
      throw new Error('No cron job found with the given name');
    });
    expect(() => cron.onApplicationBootstrap()).not.toThrow();
  });
});
