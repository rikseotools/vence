import { pagEmpleoAdapter } from './pag-empleo';
import * as pag from '../../../detect-pag-empleo/pag-empleo';

jest.mock('../../../detect-pag-empleo/pag-empleo', () => ({
  fetchPagGrupo: jest.fn(),
}));

const mockFetch = pag.fetchPagGrupo as jest.MockedFunction<typeof pag.fetchPagGrupo>;

const CONV = {
  id: '218575',
  cuerpo: 'ADMINISTRATIVO',
  grupo: 'C1',
  organismo: 'Seguridad Social',
  admin: 'AGE',
  ccaa: 'Estatal',
  plazas: 971,
  plazoHasta: '2026-01-30',
  titulacion: 'Bachiller',
};

describe('pagEmpleoAdapter', () => {
  beforeEach(() => mockFetch.mockReset());

  it('metadata correcta (Capa 2, sensor pag_empleo)', () => {
    expect(pagEmpleoAdapter.layer).toBe('aggregator');
    expect(pagEmpleoAdapter.sensorType).toBe('pag_empleo');
  });

  it('mapea PagConvocatoria → RawCandidate con preExtracted + dedupeKey legacy', async () => {
    // 6 grupos: devolvemos la convocatoria solo en el primero
    mockFetch.mockImplementation(async (g: number) => (g === 1 ? [CONV] : []));
    const out = await pagEmpleoAdapter.scan({ today: new Date('2026-07-04'), daysBack: 4 });
    expect(out).toHaveLength(1);
    const c = out[0];
    // dedupeKey IDÉNTICO al cron legacy → migración sin duplicar
    expect(c.dedupeKey).toBe('pag:218575');
    expect(c.preExtracted).toHaveLength(1);
    expect(c.preExtracted![0]).toMatchObject({ name: 'ADMINISTRATIVO', plazas: 971, positionGroup: 'C1', estado: 'inscripcion_abierta' });
    expect(c.officialUrl).toContain('idConvocatoria=218575');
  });

  it('fail-open: si un grupo lanza, no tumba el resto', async () => {
    mockFetch.mockImplementation(async (g: number) => {
      if (g === 2) throw new Error('PAG caído');
      return g === 1 ? [CONV] : [];
    });
    const out = await pagEmpleoAdapter.scan({ today: new Date('2026-07-04'), daysBack: 4 });
    expect(out).toHaveLength(1); // el grupo 2 falló pero el 1 se procesó
  });
});
