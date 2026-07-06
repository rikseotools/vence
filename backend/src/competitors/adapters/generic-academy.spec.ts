import { ACADEMY_CONFIGS, GENERIC_ACADEMY_ADAPTERS, makeAcademyAdapter } from './generic-academy';
import { jsonLdPrice } from './_shared';

describe('generic-academy', () => {
  it('cada key es único y coincide con un adapter', () => {
    const keys = ACADEMY_CONFIGS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(GENERIC_ACADEMY_ADAPTERS.length).toBe(ACADEMY_CONFIGS.length);
  });

  it('classifyUrl: hoja vs categoría vs página (varios competidores)', () => {
    const byKey = Object.fromEntries(GENERIC_ACADEMY_ADAPTERS.map((a) => [a.key, a]));
    expect(byKey['aulaplusformacion'].classifyUrl('https://aulaplusformacion.es/tienda/cursos/curso-ope-celador-andalucia/')).toBe('oposicion');
    expect(byKey['aulaplusformacion'].classifyUrl('https://aulaplusformacion.es/tienda/')).toBe('page');
    expect(byKey['masterd'].classifyUrl('https://www.oposicionesmasterd.es/curso-auxiliar-administrativo-estado')).toBe('oposicion');
    expect(byKey['masterd'].classifyUrl('https://www.oposicionesmasterd.es/cursos')).toBe('categoria');
    expect(byKey['innovaticos'].classifyUrl('https://www.innovaticos.com/oposiciones/educacion-primaria/ingles-primaria/')).toBe('oposicion');
    expect(byKey['innovaticos'].classifyUrl('https://www.innovaticos.com/oposiciones/educacion-primaria/')).toBe('categoria');
    expect(byKey['administraciondejusticia'].classifyUrl('https://www.administraciondejusticia.com/producto/curso-auxilio-judicial/')).toBe('oposicion');
    expect(byKey['formaopositores'].classifyUrl('https://formaopositores.com/project/oposiciones-correos/')).toBe('oposicion');
    expect(byKey['cetoposiciones'].classifyUrl('https://www.cetoposiciones.com/oposiciones/estado/auxiliar-administrativo')).toBe('oposicion');
    expect(byKey['cetoposiciones'].classifyUrl('https://www.cetoposiciones.com/oposiciones/estado')).toBe('categoria');
  });

  it('parseCourse extrae nombre y precio JSON-LD (WooCommerce)', () => {
    const a = makeAcademyAdapter({ key: 'x', name: 'X', baseUrl: 'https://x.es', tipo: 'academia_presencial', region: 'España', oposicion: /^\/producto\//, jsonLdPrice: true });
    const html = `<title>Curso Auxiliar Administrativo del Estado | X</title><script type="application/ld+json">{"@type":"Product","name":"Curso","offers":{"@type":"Offer","price":"62","priceCurrency":"EUR"}}</script>`;
    const c = a.parseCourse('https://x.es/producto/curso-aux/', html)!;
    expect(c.rawName).toBe('Auxiliar Administrativo del Estado');
    expect(c.prices[0]).toMatchObject({ kind: 'curso', amountCents: 6200 });
  });

  it('jsonLdPrice tolera @graph y devuelve null sin precio', () => {
    expect(jsonLdPrice('<script type="application/ld+json">{"@graph":[{"@type":"Course","name":"C"}]}</script>')).toBeNull();
    expect(jsonLdPrice('<script type="application/ld+json">{"@type":"Product","offers":{"price":"150.00","priceCurrency":"EUR"}}</script>')).toBe(15000);
  });
});
