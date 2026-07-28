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

describe('canonicalizeBoletinUrl — boletines regionales (alta confianza)', () => {
  test('DOGV: variantes de idioma _es/_va del mismo doc → mismo docKey', () => {
    const es = canonicalizeBoletinUrl('https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_es.pdf');
    const va = canonicalizeBoletinUrl('https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_va.pdf');
    expect(es.docKey).toBe('DOGV-2026-8057');
    expect(es.docKey).toBe(va.docKey); // dedup de idioma
    expect(es.boletin).toBe('DOGV');
  });
  test('BOCYL: código propio del documento', () => {
    const r = canonicalizeBoletinUrl('https://bocyl.jcyl.es/boletines/2026/06/24/pdf/BOCYL-D-24062026-120-22.pdf');
    expect(r.docKey).toBe('BOCYL-D-24062026-120-22');
    expect(r.boletin).toBe('BOCYL');
  });
  test('DOGC: documentId', () => {
    const r = canonicalizeBoletinUrl('https://portaldogc.gencat.cat/ca/document-del-dogc/?documentId=1035641');
    expect(r.docKey).toBe('DOGC-1035641');
    expect(r.boletin).toBe('DOGC');
  });

  test('BOC (Canarias): .html y .pdf del mismo anuncio → mismo docKey', () => {
    const html = canonicalizeBoletinUrl('https://www.gobiernodecanarias.org/boc/2024/239/3965.html');
    const pdf = canonicalizeBoletinUrl('https://www.gobiernodecanarias.org/boc/2024/239/3965.pdf');
    expect(html.docKey).toBe('BOC-2024-239-3965');
    expect(pdf.docKey).toBe('BOC-2024-239-3965');
    expect(html.boletin).toBe('BOC');
    expect(html.recognized).toBe(true);
    expect(html.canonicalUrl).toBe('https://www.gobiernodecanarias.org/boc/2024/239/3965.html');
  });

  test('BOJA (Andalucía): boja/AAAA/NNN/NN → BOJA-AAAA-NNN-NN', () => {
    const r = canonicalizeBoletinUrl('https://www.juntadeandalucia.es/boja/2024/191/27');
    expect(r.docKey).toBe('BOJA-2024-191-27');
    expect(r.boletin).toBe('BOJA');
    expect(r.recognized).toBe(true);
    expect(r.canonicalUrl).toBe('https://www.juntadeandalucia.es/boja/2024/191/27');
  });

  test('DOG (Galicia): variantes _es/_gl del mismo anuncio → mismo docKey', () => {
    const es = canonicalizeBoletinUrl('https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_es.html');
    const gl = canonicalizeBoletinUrl('https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_gl.html');
    expect(es.docKey).toBe('DOG-G0597-191125-0004');
    expect(gl.docKey).toBe('DOG-G0597-191125-0004');
    expect(es.boletin).toBe('DOG');
    expect(es.recognized).toBe(true);
  });

  test('MIA (portal Aragón por CSV): SPA y API convergen al mismo docKey', () => {
    const portal = canonicalizeBoletinUrl('https://mia.aragon.es/documentos?csv=CSVS60B0W34IP1Q0XFIL');
    const api = canonicalizeBoletinUrl('https://carp-core-mia.aragon.es/rest/documentos/CSVS60B0W34IP1Q0XFIL/pdf');
    expect(portal.docKey).toBe('MIA-CSVS60B0W34IP1Q0XFIL');
    expect(api.docKey).toBe('MIA-CSVS60B0W34IP1Q0XFIL');
    expect(portal.boletin).toBe('MIA');
    expect(portal.recognized).toBe(true);
    expect(portal.canonicalUrl).toBe('https://mia.aragon.es/documentos?csv=CSVS60B0W34IP1Q0XFIL');
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

// ============================================================
// [T-221] Boletines añadidos el 28/07/2026 — todos con su URL REAL verificada
// (el enlace lo emite ya el sensor; sin patrón aquí, la señal no deja provenance)
// ============================================================

describe('[T-221] boletines nuevos: BOPA, BON, BOME, DOCM', () => {
  test('BOPA (Asturias): la referencia manda, el ruido del portlet no', () => {
    const r = canonicalizeBoletinUrl(
      'https://miprincipado.asturias.es/bopa/disposiciones?p_p_id=pa_sede_bopa_web_portlet_SedeBopaDispositionWeb&p_p_lifecycle=0&p_r_p_dispositionText=2026-06220&p_r_p_dispositionReference=2026-06220&p_r_p_dispositionDate=28%2F07%2F2026',
    );
    expect(r.docKey).toBe('BOPA-2026-06220');
    expect(r.recognized).toBe(true);
  });

  test('BON (Navarra): año/boletín/orden, y la versión en euskera deduplica igual', () => {
    const es = canonicalizeBoletinUrl('https://bon.navarra.es/es/anuncio/-/texto/2026/146/1');
    const eu = canonicalizeBoletinUrl('https://bon.navarra.es/eu/anuncio/-/texto/2026/146/1');
    expect(es.docKey).toBe('BON-2026-146-1');
    expect(eu.docKey).toBe(es.docKey);
  });

  test('BON: dos anuncios del MISMO boletín NO colapsan', () => {
    const a = canonicalizeBoletinUrl('https://bon.navarra.es/es/anuncio/-/texto/2026/146/0');
    const b = canonicalizeBoletinUrl('https://bon.navarra.es/es/anuncio/-/texto/2026/146/1');
    expect(a.docKey).not.toBe(b.docKey);
  });

  test('BOME (Melilla): identifica el ARTÍCULO, no el boletín del día', () => {
    // Verificado contra el portal: /articulo/872 se titula «Artículo BOME-A-2026-872».
    const r = canonicalizeBoletinUrl('https://bomemelilla.es/bome/BOME-B-2026-6400/articulo/872');
    expect(r.docKey).toBe('BOME-A-2026-872');
  });

  test('BOME: dos artículos del mismo boletín NO colapsan (el fallo que costaría el dedup)', () => {
    const a = canonicalizeBoletinUrl('https://bomemelilla.es/bome/BOME-B-2026-6400/articulo/870');
    const b = canonicalizeBoletinUrl('https://bomemelilla.es/bome/BOME-B-2026-6400/articulo/872');
    expect(a.docKey).toBe('BOME-A-2026-870');
    expect(b.docKey).toBe('BOME-A-2026-872');
    expect(a.docKey).not.toBe(b.docKey);
  });

  test('DOCM (Castilla-La Mancha): año_número de la disposición', () => {
    const r = canonicalizeBoletinUrl(
      'https://docm.jccm.es/docm/descargarArchivo.do?ruta=2026/07/23/pdf/2026_5573.pdf&tipo=rutaDocm',
    );
    expect(r.docKey).toBe('DOCM-2026-5573');
  });

  test('DOE y BOPV siguen SIN reconocer: su URL de sumario es un envoltorio, no el documento', () => {
    // Medido el 28/07: el DOE devuelve una página de título+analítica sin la disposición y el
    // BOPV mete el texto en un iframe. Un docKey aquí sería provenance a un caparazón.
    const doe = canonicalizeBoletinUrl('https://doe.juntaex.es/otrosFormatos/html.php?xml=2026061939&anio=2026&doe=1430o');
    const bopv = canonicalizeBoletinUrl('https://www.euskadi.eus/y22-bopv/es/bopv2/datos/2026/07/2603354a.shtml');
    expect(doe.recognized).toBe(false);
    expect(bopv.recognized).toBe(false);
  });

  test('la portada del boletín NO se reconoce como documento', () => {
    expect(canonicalizeBoletinUrl('https://bon.navarra.es/es/boletin').recognized).toBe(false);
    expect(canonicalizeBoletinUrl('https://docm.jccm.es/docm/busquedaAvanzada.do').recognized).toBe(false);
  });
});
