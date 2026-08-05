import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../db/database.module';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { TipificarDocumentosCron } from './tipificar-documentos.cron';
import { TipificarDocumentosService } from './tipificar-documentos.service';

/**
 * Guardarraíl de CABLEADO (mismo patrón que fraud-sweep.module.spec.ts): que el grafo de
 * inyección del cron nuevo CIERRA. Ni `tsc` ni `nest build` lo ven — la resolución de
 * dependencias es en runtime, y un fallo aquí tumba el arranque del backend ENTERO, no solo
 * este cron.
 */
describe('TipificarDocumentosModule — cableado de dependencias', () => {
  function providers(
    overrides: {
      execute?: jest.Mock;
      emit?: jest.Mock;
      register?: jest.Mock;
    } = {},
  ) {
    return [
      TipificarDocumentosService,
      TipificarDocumentosCron,
      {
        provide: DRIZZLE,
        useValue: {
          execute: overrides.execute ?? jest.fn().mockResolvedValue([]),
        },
      },
      {
        provide: ObservabilityService,
        useValue: {
          emit: overrides.emit ?? jest.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: HeartbeatRegistry,
        useValue: { register: overrides.register ?? jest.fn() },
      },
    ];
  }

  it('el servicio se instancia con sus dependencias reales', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: providers(),
    }).compile();
    expect(moduleRef.get(TipificarDocumentosService)).toBeInstanceOf(
      TipificarDocumentosService,
    );
  });

  it('el cron se instancia y registra su heartbeat', async () => {
    const register = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: providers({ register }),
    }).compile();

    expect(moduleRef.get(TipificarDocumentosCron)).toBeInstanceOf(
      TipificarDocumentosCron,
    );
    expect(register).toHaveBeenCalledWith(
      'tipificar-documentos',
      expect.any(Function),
      expect.objectContaining({ thresholdMs: expect.any(Number) }),
    );
  });

  it('promueve una fila cuando el clasificador reconoce un tipo (SELECT → UPDATE por id)', async () => {
    const execute = jest.fn();
    // 1ª llamada: SELECT del lote de candidatos 'nota'.
    execute.mockResolvedValueOnce([
      {
        id: 'doc-1',
        url: 'https://boe.es/doc/1',
        titulo: null,
        extracted_text:
          'Real Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público para 2025',
      },
    ]);
    // 2ª llamada: el UPDATE de promoción — RETURNING con la fila.
    execute.mockResolvedValueOnce([{ id: 'doc-1' }]);

    const moduleRef = await Test.createTestingModule({
      providers: providers({ execute }),
    }).compile();
    const result = await moduleRef.get(TipificarDocumentosService).run();

    expect(result).toMatchObject({
      revisados: 1,
      promovidos: 1,
      bloqueadosPorDuplicado: 0,
      seQuedanEnNota: 0,
    });
    expect(result.porTipo.oep_decreto).toBe(1);
  });

  it('deja en nota lo que no tiene señal — no inventa tipo', async () => {
    const execute = jest.fn().mockResolvedValueOnce([
      {
        id: 'doc-2',
        url: 'https://x.es/y',
        titulo: null,
        extracted_text: 'Guía para la tutoría',
      },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: providers({ execute }),
    }).compile();
    const result = await moduleRef.get(TipificarDocumentosService).run();

    expect(result).toMatchObject({
      revisados: 1,
      promovidos: 0,
      seQuedanEnNota: 1,
    });
    expect(execute).toHaveBeenCalledTimes(1); // ni un UPDATE si no hay tipo que promover
  });

  it('un duplicado real (unique_violation) NO tumba el barrido — se cuenta y se sigue', async () => {
    const execute = jest.fn();
    execute.mockResolvedValueOnce([
      {
        id: 'doc-3',
        url: 'https://boe.es/doc/3',
        titulo: null,
        extracted_text:
          'Resolución por la que se convoca proceso selectivo para varias plazas',
      },
    ]);
    execute.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "ux_convocatoria_documentos_conv_dockey"',
        ),
        { code: '23505' },
      ),
    );

    const moduleRef = await Test.createTestingModule({
      providers: providers({ execute }),
    }).compile();
    const result = await moduleRef.get(TipificarDocumentosService).run();

    expect(result).toMatchObject({
      revisados: 1,
      promovidos: 0,
      bloqueadosPorDuplicado: 1,
    });
  });
});
