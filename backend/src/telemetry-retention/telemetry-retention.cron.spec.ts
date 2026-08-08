import { TelemetryRetentionCron } from './telemetry-retention.cron';
import type { TelemetryRetentionService } from './telemetry-retention.service';
import type { ObservabilityService } from '../observability/observability.service';
import type { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';

/**
 * Lo que el cron EMITE, que no es lo mismo que lo que el servicio DEVUELVE.
 *
 * Los specs del servicio prueban `run()`; nadie probaba qué acaba en
 * `observable_events`, y ahí es donde se mira una noche a las tres de la mañana.
 * [T-360]: el día que `observable_events` pase a estar particionada,
 * `observableEventsDeleted` valdrá 0 para siempre porque la retención dropea
 * particiones en vez de borrar filas — sin los dos campos nuevos, ese evento
 * diría «0 borradas» y sería indistinguible de un drenaje muerto (que es
 * literalmente el incidente [T-613]).
 */
describe('TelemetryRetentionCron — el evento que emite', () => {
  const resultadoBase = {
    observableEventsDeleted: 0,
    validationErrorLogsDeleted: 12,
    batches: 1,
    remaining: { observable_events: 0 },
    vacuumFailed: [],
    observableEventsPorParticion: false,
    observableEventsParticionesDropeadas: 0,
  };

  function montar(resultado: typeof resultadoBase) {
    const emit = jest.fn().mockResolvedValue(undefined);
    // `runWithHeartbeat` emite el `cron_tick` de arranque por otra vía (fire-and-forget);
    // sin este doble, el wrapper revienta antes de llegar al `cron_run` que se quiere probar.
    const emitFireAndForget = jest.fn();
    const service = { run: jest.fn().mockResolvedValue(resultado) };
    const registry = { register: jest.fn() };
    const cron = new TelemetryRetentionCron(
      service as unknown as TelemetryRetentionService,
      { emit, emitFireAndForget } as unknown as ObservabilityService,
      registry as unknown as HeartbeatRegistry,
    );
    return { cron, emit };
  }

  const exito = (emit: jest.Mock) =>
    emit.mock.calls
      .map((c) => c[0])
      .find((e) => e?.eventType === 'cron_run' && e?.metadata?.status === 'success');

  it('hoy (sin particionar) emite los dos campos, aunque valgan false/0', async () => {
    const { cron, emit } = montar(resultadoBase);
    await cron.handle();

    const ev = exito(emit);
    expect(ev).toBeDefined();
    expect(ev.metadata).toHaveProperty('observableEventsPorParticion', false);
    expect(ev.metadata).toHaveProperty('observableEventsParticionesDropeadas', 0);
  });

  it('el día del swap, «0 borradas» viene acompañado de las particiones dropeadas', async () => {
    const { cron, emit } = montar({
      ...resultadoBase,
      observableEventsDeleted: 0,
      observableEventsPorParticion: true,
      observableEventsParticionesDropeadas: 3,
    });
    await cron.handle();

    const ev = exito(emit);
    // Este es el caso que hace útil el cambio: deleted=0 y aun así se ve el drenaje.
    expect(ev.metadata.observableEventsDeleted).toBe(0);
    expect(ev.metadata.observableEventsPorParticion).toBe(true);
    expect(ev.metadata.observableEventsParticionesDropeadas).toBe(3);
  });

  it('sigue emitiendo lo de antes (remaining y vacuumFailed no se pierden)', async () => {
    const { cron, emit } = montar({
      ...resultadoBase,
      remaining: { observable_events: 4321 },
      vacuumFailed: ['observable_events'],
    });
    await cron.handle();

    const ev = exito(emit);
    expect(ev.metadata.remaining).toEqual({ observable_events: 4321 });
    expect(ev.metadata.vacuumFailed).toEqual(['observable_events']);
  });
});
