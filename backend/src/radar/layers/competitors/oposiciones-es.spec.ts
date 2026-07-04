import { parseListado, parseOfficialLink } from './oposiciones-es';

describe('oposiciones-es adapter', () => {
  it('parseListado extrae solo tarjetas de convocatoria (por slug con nº de plazas)', () => {
    const html = `
      <a href="https://oposiciones.es/convocatorias/20-plazas-de-administrativo-en-el-ayuntamiento-de-vic-barcelona/">Vic</a>
      <a href="https://oposiciones.es/convocatorias/1-050-plazas-al-cuerpo-de-ayudantes-de-instituciones-penitenciarias/">IIPP</a>
      <a href="https://oposiciones.es/convocatorias/oposiciones-asturias/">categoría (ignorar)</a>
      <a href="https://oposiciones.es/academias/foo/">academia (ignorar)</a>
    `;
    const out = parseListado(html);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.sourceUrl)).toEqual([
      'https://oposiciones.es/convocatorias/20-plazas-de-administrativo-en-el-ayuntamiento-de-vic-barcelona/',
      'https://oposiciones.es/convocatorias/1-050-plazas-al-cuerpo-de-ayudantes-de-instituciones-penitenciarias/',
    ]);
    expect(out[0].rawName).toContain('administrativo');
  });

  it('no duplica tarjetas repetidas', () => {
    const url =
      'href="https://oposiciones.es/convocatorias/20-plazas-de-administrativo-en-vic/"';
    expect(parseListado(`${url} ${url}`)).toHaveLength(1);
  });

  it('parseOfficialLink saca el enlace al boletín oficial (DOGC/BOE…)', () => {
    expect(
      parseOfficialLink('bla <a href="https://portaldogc.gencat.cat/utilsEADOP/x.pdf">DOGC</a> bla'),
    ).toContain('gencat');
    expect(
      parseOfficialLink('ref https://www.boe.es/boe/dias/2026/07/03/pdfs/BOE-A.pdf aquí'),
    ).toContain('boe.es');
    expect(parseOfficialLink('sin enlaces oficiales')).toBeNull();
  });
});
