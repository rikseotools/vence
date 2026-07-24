// __tests__/lib/convocatoria/canonicalizeBoletinUrl.test.js
//
// Canonicalización PURA de URLs de boletín → docKey estable (dedup del hub de provenance
// convocatoria_documentos). Cubre el caso que motivó todo: el mismo BOE referenciado como
// txt.php (source_url del epígrafe) y como /pdfs/….pdf (fila clonada) debe converger.

const { canonicalizeBoletinUrl, normalizeUrl } = require('../../../lib/convocatoria/canonicalizeBoletinUrl.cjs');

describe('canonicalizeBoletinUrl — BOE dedup (el bug real)', () => {
  test('txt.php y /pdfs del MISMO BOE → mismo docKey', () => {
    const a = canonicalizeBoletinUrl('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262');
    const b = canonicalizeBoletinUrl('https://www.boe.es/boe/dias/2025/12/22/pdfs/BOE-A-2025-26262.pdf');
    expect(a.docKey).toBe('BOE-A-2025-26262');
    expect(b.docKey).toBe('BOE-A-2025-26262');
    expect(a.docKey).toBe(b.docKey); // <- convergen: dedup
    expect(a.canonicalUrl).toBe(b.canonicalUrl); // canónica reconstruida desde el id
    expect(a.boletin).toBe('BOE');
    expect(a.recognized).toBe(true);
  });

  test('buscar/act.php (ley consolidada) también extrae el id', () => {
    const r = canonicalizeBoletinUrl('https://www.boe.es/buscar/act.php?id=BOE-A-2023-7500');
    expect(r.docKey).toBe('BOE-A-2023-7500');
    expect(r.canonicalUrl).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-7500');
  });

  test('BOE-B (anuncios) y BOE-S (sumarios) reconocidos', () => {
    expect(canonicalizeBoletinUrl('https://www.boe.es/x?id=BOE-B-2026-123').docKey).toBe('BOE-B-2026-123');
    expect(canonicalizeBoletinUrl('https://www.boe.es/x?id=BOE-S-2026-99').docKey).toBe('BOE-S-2026-99');
  });
});

describe('canonicalizeBoletinUrl — BOCM', () => {
  test('BOCM extrae AAAAMMDD-secuencia', () => {
    const r = canonicalizeBoletinUrl('https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/18/BOCM-20260218-2.PDF');
    expect(r.docKey).toBe('BOCM-20260218-2');
    expect(r.boletin).toBe('BOCM');
    expect(r.recognized).toBe(true);
  });
});

describe('canonicalizeBoletinUrl — reserva segura para boletines no reconocidos', () => {
  test('web de CCAA (comunidad.madrid) → docKey = URL normalizada, recognized:false', () => {
    const r = canonicalizeBoletinUrl('https://www.comunidad.madrid/servicios/empleo/auxiliares-c2-2026');
    expect(r.recognized).toBe(false);
    expect(r.boletin).toBe('unknown');
    expect(r.docKey).toBe('https://www.comunidad.madrid/servicios/empleo/auxiliares-c2-2026');
  });

  test('dos URLs distintas NO reconocidas NO deduplican entre sí', () => {
    const a = canonicalizeBoletinUrl('https://dogv.gva.es/doc/A');
    const b = canonicalizeBoletinUrl('https://dogv.gva.es/doc/B');
    expect(a.docKey).not.toBe(b.docKey);
  });

  test('la MISMA URL no reconocida, con diferencias triviales, SÍ deduplica', () => {
    const a = canonicalizeBoletinUrl('https://DOGV.gva.es/doc/X/');
    const b = canonicalizeBoletinUrl('https://dogv.gva.es/doc/X#seccion');
    expect(a.docKey).toBe(b.docKey); // host minúsculas, barra final y fragmento fuera
  });
});

describe('normalizeUrl — determinista', () => {
  test('host a minúsculas, sin fragmento, sin barra final', () => {
    expect(normalizeUrl('https://WWW.Example.COM/Path/#frag')).toBe('https://www.example.com/Path');
  });
  test('query ordenada por clave', () => {
    expect(normalizeUrl('https://x.es/a?b=2&a=1')).toBe('https://x.es/a?a=1&b=2');
  });
  test('puertos por defecto eliminados', () => {
    expect(normalizeUrl('http://x.es:80/a')).toBe('http://x.es/a');
    expect(normalizeUrl('https://x.es:443/a')).toBe('https://x.es/a');
  });
  test('raíz conserva su barra', () => {
    expect(normalizeUrl('https://x.es/')).toBe('https://x.es/');
  });
});

describe('canonicalizeBoletinUrl — entradas vacías', () => {
  test('null / undefined / vacío → docKey null, no revienta', () => {
    for (const v of [null, undefined, '', '   ']) {
      const r = canonicalizeBoletinUrl(v);
      expect(r.docKey).toBeNull();
      expect(r.recognized).toBe(false);
    }
  });
});
