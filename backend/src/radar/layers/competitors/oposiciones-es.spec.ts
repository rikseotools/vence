import { parseListado, parseOfficialLink, parseCard } from './oposiciones-es';

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

  it('parseCard extrae nombre + plazas del título (incl. miles "1 050")', () => {
    expect(parseCard('20 plazas de administrativo en el ayuntamiento de vic barcelona')).toEqual({
      name: 'Administrativo en el ayuntamiento de vic barcelona',
      plazas: 20,
    });
    expect(parseCard('1 050 plazas al cuerpo de ayudantes de instituciones penitenciarias').plazas).toBe(1050);
    expect(parseCard('sin numero de plazas').plazas).toBeNull();
  });

  it('parseListado rellena preExtracted (salta el LLM)', () => {
    const html = 'x <a href="https://oposiciones.es/convocatorias/35-plazas-de-administrativo-en-la-diputacion-provincial-de-jaen/">j</a>';
    const [c] = parseListado(html);
    expect(c.preExtracted).toHaveLength(1);
    expect(c.preExtracted![0].plazas).toBe(35);
    // NO se afirma estado sin fecha de cierre: la lista no trae el plazo, así que
    // estado=null (se deriva de las fechas oficiales en el triaje). Ver fix 08/07.
    expect(c.preExtracted![0].estado).toBeNull();
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
