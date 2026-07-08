import {
  CCAA_BOLETINES,
  CCAA_BOLETIN_ADAPTERS,
  collectJsonTitles,
  makeCcaaTemarioAdapter,
  type CcaaBoletinConfig,
} from './ccaa-boletines';

describe('collectJsonTitles', () => {
  it('extrae de un array top-level (Socrata/DOGC)', () => {
    const json = [
      { t_tol_de_la_norma: 'Ordre A', otro: 1 },
      { t_tol_de_la_norma_es: 'Orden B' },
    ];
    expect(collectJsonTitles(json, ['t_tol_de_la_norma', 't_tol_de_la_norma_es'])).toEqual([
      'Ordre A',
      'Orden B',
    ]);
  });

  it('extrae de un array anidado (DOGV: disposiciones)', () => {
    const json = { cabecera: { numeroDogv: 1 }, disposiciones: [{ titulo: 'RESOLUCIÓN X' }] };
    expect(collectJsonTitles(json, ['titulo'], 'disposiciones')).toEqual(['RESOLUCIÓN X']);
  });

  it('día sin boletín (disposiciones=null) → vacío, sin romper', () => {
    expect(collectJsonTitles({ disposiciones: null }, ['titulo'], 'disposiciones')).toEqual([]);
  });

  it('un título por registro (no duplica por varios fields)', () => {
    const json = [{ a: 'T1', b: 'T1-es' }];
    expect(collectJsonTitles(json, ['a', 'b'])).toEqual(['T1']);
  });
});

describe('CCAA_BOLETINES config', () => {
  it('cada boletín define EXACTAMENTE una estrategia de URL', () => {
    for (const c of CCAA_BOLETINES) {
      const strategies = [c.sumarioUrl, c.buildUrl, c.buildUrls, c.resolveUrl].filter(
        (x) => x != null,
      );
      expect(strategies.length).toBe(1);
    }
  });

  it('las keys son únicas', () => {
    const keys = CCAA_BOLETINES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('incluye Cantabria (el caso que motivó el sensor)', () => {
    expect(CCAA_BOLETINES.some((c) => c.key === 'boc-cantabria')).toBe(true);
  });

  it('cubre las CCAA por fetch plano (>=13 boletines)', () => {
    expect(CCAA_BOLETINES.length).toBeGreaterThanOrEqual(13);
  });

  it('un adapter genera dateless=false si es date-based (buildUrl/buildUrls)', () => {
    const dateBased: CcaaBoletinConfig = {
      key: 't',
      regionName: 'T',
      format: 'html',
      buildUrl: () => 'https://x',
    };
    expect(makeCcaaTemarioAdapter(dateBased).dateless).toBe(false);

    const dateless: CcaaBoletinConfig = {
      key: 't2',
      regionName: 'T2',
      format: 'html',
      sumarioUrl: 'https://x',
    };
    expect(makeCcaaTemarioAdapter(dateless).dateless).toBe(true);
  });

  it('todos los adapters son temario-only (sensorType regional_scan)', () => {
    for (const a of CCAA_BOLETIN_ADAPTERS) {
      expect(a.sensorType).toBe('regional_scan');
    }
  });
});
