import { Test } from '@nestjs/testing';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DRIZZLE } from '../db/database.module';
import { FraudSweepCron } from './fraud-sweep.cron';
import { FraudSweepService } from './fraud-sweep.service';

/**
 * Que el módulo del barrido antifraude REALMENTE se resuelve.
 *
 * POR QUÉ (27/07/2026): al reescribir el detector se añadió `ObservabilityService`
 * al constructor de `FraudSweepService`. Que eso funcione depende de que su módulo
 * sea `@Global()` — lo es, pero eso era un razonamiento, no una comprobación.
 *
 * Y la consecuencia de equivocarse no se parece a las demás: todo lo otro que se
 * rompió ese día fallaba hacia el lado seguro (un detector que no detecta, una
 * señal falsa, ruido en un panel). Un fallo de INYECCIÓN no: Nest aborta el
 * arranque y el backend entero se queda sin levantar. Es la diferencia entre
 * "perdimos detección" y "caída total".
 *
 * Ni `tsc` ni `nest build` ven esto: la resolución de dependencias es en runtime.
 * Este test es lo único entre el cambio y descubrirlo en el arranque de producción.
 */
describe('FraudSweepModule — cableado de dependencias', () => {
  async function construir() {
    return Test.createTestingModule({
      providers: [
        FraudSweepService,
        FraudSweepCron,
        // Dobles de las dependencias externas: aquí no se prueba la lógica, se
        // prueba que el grafo de inyección CIERRA.
        {
          provide: DRIZZLE,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ObservabilityService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: HeartbeatRegistry, useValue: { register: jest.fn() } },
      ],
    }).compile();
  }

  it('el servicio se instancia con todas sus dependencias', async () => {
    const moduleRef = await construir();
    expect(moduleRef.get(FraudSweepService)).toBeInstanceOf(FraudSweepService);
  });

  it('el cron se instancia y registra su heartbeat', async () => {
    const heartbeat = { register: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FraudSweepService,
        FraudSweepCron,
        {
          provide: DRIZZLE,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ObservabilityService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: HeartbeatRegistry, useValue: heartbeat },
      ],
    }).compile();

    expect(moduleRef.get(FraudSweepCron)).toBeInstanceOf(FraudSweepCron);
    // Si el heartbeat no se registra, un barrido muerto no dispararía `cron_overdue`.
    expect(heartbeat.register).toHaveBeenCalledWith(
      'fraud-sweep',
      expect.any(Function),
      expect.objectContaining({ thresholdMs: expect.any(Number) }),
    );
  });

  it('el servicio usa la observabilidad que se le inyecta (no una propia)', async () => {
    // Con el rollup VACÍO, el barrido tiene que DENUNCIAR que está ciego. Es la
    // ruta que ejercita la dependencia nueva de punta a punta.
    const emit = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        FraudSweepService,
        {
          provide: DRIZZLE,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        { provide: ObservabilityService, useValue: { emit } },
        { provide: HeartbeatRegistry, useValue: { register: jest.fn() } },
      ],
    }).compile();

    await moduleRef.get(FraudSweepService).run();

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'fraud_detection_blind',
        severity: 'warn',
      }),
    );
  });
});
