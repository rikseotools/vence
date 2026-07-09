// Lote de 3 adapters nuevos (09/07/2026): examinatest, opomur, temariosenpdf.
// Shapes HTML/JSON tomados de las hojas reales (sondeo 09/07).

import { classifyExaminatestUrl, discoverExaminatestUrls, parseExaminatestCourse } from './examinatest';
import { classifyOpomurUrl, discoverOpomurUrls, parseOpomurCourse } from './opomur';
import { classifyTemariosenpdfUrl, parseTemariosenpdfCourse } from './temariosenpdf';
import { jsonLdPrice } from './_shared';

describe('examinatest', () => {
  it('classifyUrl: /oposiciones/<slug> = oposición; listado y suscripción = otros', () => {
    expect(classifyExaminatestUrl('https://www.examinatest.es/oposiciones/administrativo-estado')).toBe('oposicion');
    expect(classifyExaminatestUrl('https://www.examinatest.es/oposiciones')).toBe('categoria');
    expect(classifyExaminatestUrl('https://www.examinatest.es/oposiciones/administrativo-estado/suscripcion')).toBe('page');
  });
  it('discoverUrls extrae hojas del listado y descarta /suscripcion', () => {
    const html = `
      <a href="/oposiciones/administrativo-estado">Admin</a>
      <a href="https://www.examinatest.es/oposiciones/guardia-civil">GC</a>
      <a href="/oposiciones/administrativo-estado/suscripcion">planes</a>`;
    const urls = discoverExaminatestUrls(html);
    expect(urls).toContain('https://www.examinatest.es/oposiciones/administrativo-estado');
    expect(urls).toContain('https://www.examinatest.es/oposiciones/guardia-civil');
    expect(urls.some((u) => /suscripcion/.test(u))).toBe(false);
  });
  it('parseCourse saca nombre del H1 y precio "Desde 9,99 €/mes"', () => {
    const html = '<h1>Administrativo General del Estado (Turno Libre)</h1><p>Test online — Desde 9,99 €/mes</p>';
    const c = parseExaminatestCourse('https://www.examinatest.es/oposiciones/administrativo-estado', html)!;
    expect(c.rawName).toBe('Administrativo General del Estado (Turno Libre)');
    expect(c.prices[0]).toMatchObject({ kind: 'cuota', amountCents: 999, period: 'mensual' });
  });
});

describe('opomur', () => {
  it('classifyUrl: /producto/<slug>/ = oposición; tienda = categoría', () => {
    expect(classifyOpomurUrl('https://opomur.es/producto/modalidad-normal-auxiliar-administrativo-del-estado/')).toBe('oposicion');
    expect(classifyOpomurUrl('https://opomur.es/tienda/')).toBe('categoria');
    expect(classifyOpomurUrl('https://opomur.es/mi-cuenta/')).toBe('page');
  });
  it('discoverUrls extrae permalinks de producto del JSON de la Store API', () => {
    const json = JSON.stringify([
      { permalink: 'https://opomur.es/producto/sms-promocion/' },
      { permalink: 'https://opomur.es/producto/modalidad-normal-auxiliar-administrativo-del-estado/' },
      { permalink: 'https://opomur.es/categoria/otra/' },
    ]);
    const urls = discoverOpomurUrls(json);
    expect(urls).toEqual([
      'https://opomur.es/producto/sms-promocion/',
      'https://opomur.es/producto/modalidad-normal-auxiliar-administrativo-del-estado/',
    ]);
  });
  it('parseCourse NO usa el <title> genérico; nombre del H1 product_title + cuota mensual', () => {
    const html = `
      <title>Opomur - Plataforma de test para oposiciones</title>
      <h1 class="product_title entry-title">Modalidad Normal Auxiliar Administrativo del Estado</h1>
      <script type="application/ld+json">{"@type":"Product","name":"Modalidad Normal Auxiliar Administrativo del Estado","offers":{"@type":"Offer","price":"45.00","priceCurrency":"EUR"}}</script>`;
    const c = parseOpomurCourse('https://opomur.es/producto/modalidad-normal-auxiliar-administrativo-del-estado/', html)!;
    expect(c.rawName).toBe('Modalidad Normal Auxiliar Administrativo del Estado');
    expect(c.rawName).not.toBe('Opomur');
    expect(c.prices[0]).toMatchObject({ kind: 'cuota', amountCents: 4500, period: 'mensual' });
  });
});

describe('temariosenpdf', () => {
  it('classifyUrl: /products/<slug> = oposición; /collections = categoría', () => {
    expect(classifyTemariosenpdfUrl('https://www.temariosenpdf.es/products/temario-auxiliares-administrativos-cantabria')).toBe('oposicion');
    expect(classifyTemariosenpdfUrl('https://www.temariosenpdf.es/collections/temarios')).toBe('categoria');
    expect(classifyTemariosenpdfUrl('https://www.temariosenpdf.es/pages/preguntas-frecuentes')).toBe('page');
  });
  it('parseCourse: precio único desde AggregateOffer (Shopify usa lowPrice, no price)', () => {
    const html = `
      <title>PACK TEMARIO OPOSICIONES CONSERJES AYUNTAMIENTO DE FUENLABRADA | Temarios en PDF</title>
      <script type="application/ld+json">{"@type":"Product","name":"Pack Conserjes","offers":{"@type":"AggregateOffer","lowPrice":"33.00","highPrice":"33.00","priceCurrency":"EUR"}}</script>`;
    const c = parseTemariosenpdfCourse('https://www.temariosenpdf.es/products/pack-temario-oposiciones-conserjes', html)!;
    expect(c.prices).toHaveLength(1);
    expect(c.prices[0]).toMatchObject({ kind: 'material', amountCents: 3300, period: 'unico' });
  });
  it('limpia el prefijo de formato "TEMARIO PDF" del nombre', () => {
    const c = parseTemariosenpdfCourse(
      'https://www.temariosenpdf.es/products/x',
      '<title>TEMARIO PDF ADMINISTRATIVOS AYUNTAMIENTO DE LAS PALMAS</title>',
    )!;
    expect(c.rawName).toBe('ADMINISTRATIVOS AYUNTAMIENTO DE LAS PALMAS');
  });
  it('corta el sufijo de marca aunque el separador sea la entidad &ndash;', () => {
    const c = parseTemariosenpdfCourse(
      'https://www.temariosenpdf.es/products/x',
      '<title>TEST DE REPASO CELADORES (2) &ndash; Temarios en PDF</title>',
    )!;
    expect(c.rawName).toBe('TEST DE REPASO CELADORES (2)');
  });
  it('graceful: hoja sin JSON-LD de producto (shell de error) → sin precio, no lanza', () => {
    const c = parseTemariosenpdfCourse(
      'https://www.temariosenpdf.es/products/x',
      '<title>Temario X | Temarios en PDF</title><h1>Oops! Algo salió mal</h1>',
    );
    expect(c).not.toBeNull();
    expect(c!.prices).toEqual([]);
  });
});

describe('_shared.jsonLdPrice — AggregateOffer', () => {
  it('lee lowPrice cuando offers es AggregateOffer (sin campo price)', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"@type":"AggregateOffer","lowPrice":"19.00","highPrice":"29.00","priceCurrency":"EUR"}}</script>`;
    expect(jsonLdPrice(html)).toBe(1900);
  });
  it('sigue prefiriendo price en un Offer normal (no regresión)', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"@type":"Offer","price":"45.00","priceCurrency":"EUR"}}</script>`;
    expect(jsonLdPrice(html)).toBe(4500);
  });
});
