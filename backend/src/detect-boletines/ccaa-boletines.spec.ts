import {
  CCAA_BOLETINES,
  CCAA_BOLETIN_ADAPTERS,
  collectJsonTitles,
  collectJsonEntradas,
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

// ============================================================
// [T-221] Enlace al anuncio en los boletines JSON
// ============================================================

describe('[T-221] collectJsonEntradas', () => {
  // Registro REAL del sumario del DOGV (dogv.gva.es/dogv-portal/dogv?date=2026-07-21).
  const DOGV_REAL = {
    disposiciones: [
      {
        id: 486327,
        titulo:
          'RESOLUCIÓN de 16 de julio de 2026, por la que se convoca la creación, con carácter urgente, de una bolsa de empleo temporal de auxiliares de servicios.',
        codigoInsercion: '2026/24586',
        urlPdf: '/2026/07/21/pdf/2026_24586_es.pdf',
      },
    ],
  };

  const dogv = CCAA_BOLETINES.find((c) => c.key === 'dogv')!;

  it('adjunta a cada disposición SU pdf (el DOGV lo trae por registro)', () => {
    const entradas = collectJsonEntradas(
      DOGV_REAL,
      dogv.titleFields!,
      dogv.jsonArrayField,
      dogv.urlFields!,
      dogv.urlBase,
      dogv.urlMap,
    );
    expect(entradas).toHaveLength(1);
    expect(entradas[0].titulo).toContain('bolsa de empleo temporal');
    expect(entradas[0].url).toBe('https://dogv.gva.es/datos/2026/07/21/pdf/2026_24586_es.pdf');
  });

  it('SIN el prefijo /datos la URL del DOGV devuelve 200 con el HTML del portal: el mapeo NO es cosmético', () => {
    // Medido el 28/07: sin /datos → 200 text/html de 126 KB (la SPA); con /datos → PDF de 967 KB.
    // Además `boletin_doc_key` solo reconoce la forma con /datos, así que sin esto no se clona.
    const entradas = collectJsonEntradas(DOGV_REAL, dogv.titleFields!, dogv.jsonArrayField, dogv.urlFields!, dogv.urlBase, dogv.urlMap);
    expect(entradas[0].url).toContain('/datos/');
  });

  it('acepta el enlace envuelto en objeto (Socrata/DOGC: format_html.url)', () => {
    const json = [
      {
        t_tol_de_la_norma_es: 'Resolución por la que se convoca proceso selectivo.',
        format_html: { url: 'https://portaljuridic.gencat.cat/eli/es-ct/res/2026/07/07/103/dof/spa/html' },
      },
    ];
    const entradas = collectJsonEntradas(json, ['t_tol_de_la_norma_es'], undefined, ['format_html', 'format_pdf']);
    expect(entradas[0].url).toContain('portaljuridic.gencat.cat');
  });

  it('registro sin campo de enlace → url null (no se inventa)', () => {
    const entradas = collectJsonEntradas([{ titulo: 'Orden X' }], ['titulo'], undefined, ['urlPdf'], 'https://x.es');
    expect(entradas[0].url).toBeNull();
  });

  it('paridad: collectJsonTitles sigue devolviendo los mismos títulos', () => {
    expect(collectJsonTitles(DOGV_REAL, dogv.titleFields!, dogv.jsonArrayField)).toEqual(
      collectJsonEntradas(DOGV_REAL, dogv.titleFields!, dogv.jsonArrayField).map((e) => e.titulo),
    );
  });
});

// GUARDARRAÍL DE CABLEADO: el enlace no sirve de nada si el sensor deja de pegarlo a la señal.
// Esto se rompe si alguien quita la llamada, y es justo el fallo que no se ve en ningún test
// de unidad (cada pieza seguiría verde por separado).
describe('[T-221] guardarraíl de cableado sensor → señal', () => {
  const fuente = require('fs').readFileSync(
    require('path').join(__dirname, 'detect-boletines.service.ts'),
    'utf8',
  ) as string;

  it('el servicio adjudica el enlace del candidato a la señal', () => {
    expect(fuente).toMatch(/urlDelCandidato\(\s*oep\.name\s*,\s*hit\.candidatos\s*\)/);
  });

  it('la señal se queda con la URL del anuncio y solo cae al sumario si no hay', () => {
    expect(fuente).toMatch(/sourceUrl:\s*urlAnuncio\s*\?\?\s*hit\.url/);
  });

  it('conserva la procedencia (de qué sumario salió) para poder reauditar', () => {
    expect(fuente).toMatch(/sumarioUrl:\s*hit\.url/);
  });
});
