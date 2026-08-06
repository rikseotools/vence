import { DetectOepLlmService } from './detect-oep-llm.service';
import type { OposicionToScan } from '../oep-signals/oep-signals-queries.types';

/**
 * Cableado del embudo determinista (T-166) en `DetectOepLlmService.run()`.
 *
 * `necesita-llm.spec.ts` fija la DECISIÓN pura; esto fija que la decisión se
 * USA de verdad: el hash se calcula y se persiste SIEMPRE, y la llamada al LLM
 * solo se salta cuando el gate lo dice — no antes de intentar el fetch, no
 * saltándose la persistencia del hash.
 *
 * Instanciación directa (sin `Test.createTestingModule`): los dos colaboradores
 * son inyección de constructor plana, así que unos mocks mínimos bastan y el
 * test no depende del árbol de módulos NestJS.
 */
function buildOpo(overrides: Partial<OposicionToScan> = {}): OposicionToScan {
  return {
    id: 'opo-1',
    nombre: 'Auxiliar Administrativo',
    slug: 'auxiliar-administrativo-test',
    shortName: null,
    seguimientoUrl: 'https://example.org/seguimiento',
    estadoProceso: null,
    plazasLibres: null,
    plazasDiscapacidad: null,
    oepFecha: null,
    convocatoriaNumero: null,
    isActive: true,
    examDate: null,
    fetcherType: 'http',
    oepLlmInputHash: null,
    ...overrides,
  };
}

describe('DetectOepLlmService.run() — embudo determinista (T-166)', () => {
  it('sin hash previo: llama al LLM y persiste el hash calculado', async () => {
    const opo = buildOpo({ oepLlmInputHash: null });
    const updateOepLlmInputHash = jest.fn().mockResolvedValue(undefined);
    const extractOepFromHtml = jest.fn().mockResolvedValue(null); // sin OEP: no genera señal, no importa aquí
    const queries = {
      getOposicionesForLlmScan: jest.fn().mockResolvedValue([opo]),
      updateOepLlmInputHash,
      insertSignal: jest.fn().mockResolvedValue({ inserted: false, id: null }),
    };
    const llm = {
      fetchPageHtml: jest.fn().mockResolvedValue({ html: '<p>Convocatoria 2026</p>' }),
      computeLlmInputHash: jest.fn().mockReturnValue('hash-del-html'),
      extractOepFromHtml,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DetectOepLlmService(queries as any, llm as any);
    const stats = await service.run();

    expect(updateOepLlmInputHash).toHaveBeenCalledWith('opo-1', 'hash-del-html');
    expect(extractOepFromHtml).toHaveBeenCalled(); // sin hash previo, SIEMPRE llama
    expect(stats.skippedByGate).toBe(0);
  });

  it('con hash IDÉNTICO al de la última pasada: NO llama al LLM, pero SÍ re-persiste el hash', async () => {
    const opo = buildOpo({ oepLlmInputHash: 'hash-del-html' });
    const updateOepLlmInputHash = jest.fn().mockResolvedValue(undefined);
    const extractOepFromHtml = jest.fn();
    const queries = {
      getOposicionesForLlmScan: jest.fn().mockResolvedValue([opo]),
      updateOepLlmInputHash,
      insertSignal: jest.fn().mockResolvedValue({ inserted: false, id: null }),
    };
    const llm = {
      fetchPageHtml: jest.fn().mockResolvedValue({ html: '<p>Convocatoria 2026</p>' }),
      computeLlmInputHash: jest.fn().mockReturnValue('hash-del-html'), // MISMO hash
      extractOepFromHtml,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DetectOepLlmService(queries as any, llm as any);
    const stats = await service.run();

    expect(extractOepFromHtml).not.toHaveBeenCalled(); // el ahorro real
    expect(updateOepLlmInputHash).toHaveBeenCalledWith('opo-1', 'hash-del-html'); // se sigue registrando
    expect(stats.skippedByGate).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('con hash DISTINTO al de la última pasada: SÍ llama al LLM', async () => {
    const opo = buildOpo({ oepLlmInputHash: 'hash-viejo' });
    const extractOepFromHtml = jest.fn().mockResolvedValue(null);
    const queries = {
      getOposicionesForLlmScan: jest.fn().mockResolvedValue([opo]),
      updateOepLlmInputHash: jest.fn().mockResolvedValue(undefined),
      insertSignal: jest.fn().mockResolvedValue({ inserted: false, id: null }),
    };
    const llm = {
      fetchPageHtml: jest.fn().mockResolvedValue({ html: '<p>Convocatoria 2027 (nueva)</p>' }),
      computeLlmInputHash: jest.fn().mockReturnValue('hash-nuevo'),
      extractOepFromHtml,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DetectOepLlmService(queries as any, llm as any);
    const stats = await service.run();

    expect(extractOepFromHtml).toHaveBeenCalled();
    expect(stats.skippedByGate).toBe(0);
  });

  it('un error de fetch NO calcula ni persiste hash (no hay HTML del que hashear)', async () => {
    const opo = buildOpo();
    const updateOepLlmInputHash = jest.fn();
    const computeLlmInputHash = jest.fn();
    const queries = {
      getOposicionesForLlmScan: jest.fn().mockResolvedValue([opo]),
      updateOepLlmInputHash,
      insertSignal: jest.fn().mockResolvedValue({ inserted: false, id: null }),
    };
    const llm = {
      fetchPageHtml: jest.fn().mockResolvedValue({ html: null, error: 'timeout' }),
      computeLlmInputHash,
      extractOepFromHtml: jest.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DetectOepLlmService(queries as any, llm as any);
    const stats = await service.run();

    expect(computeLlmInputHash).not.toHaveBeenCalled();
    expect(updateOepLlmInputHash).not.toHaveBeenCalled();
    expect(stats.errors).toBe(1);
  });
});
