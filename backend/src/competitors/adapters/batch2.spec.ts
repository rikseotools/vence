import { classifyTemariosehsUrl, parseTemariosehsCourse } from './temariosehs';
import { classifyFlouUrl, parseFlouCourse } from './oposicionesflou';
import { classifySuperaUrl } from './superaoposiciones';
import { classifyMadUrl } from './mad';
import { classifyOpositasUrl, parseOpositasCourse } from './opositas';
import { classifyAdamsUrl, parseAdamsCourse, parseAdamsJsonLd } from './adams';
import { classifyGokoanUrl, parseGokoanCourse } from './gokoan';

describe('temariosehs', () => {
  it('classifyUrl filtra por slug de oposición', () => {
    expect(classifyTemariosehsUrl('https://temariosehs.com/temario-administrativo-junta-de-andalucia/')).toBe('oposicion');
    expect(classifyTemariosehsUrl('https://temariosehs.com/55-plazas-auxiliar-administrativo-ayuntamiento-de-cordoba/')).toBe('oposicion');
    expect(classifyTemariosehsUrl('https://temariosehs.com/pagina-privada/juan/')).toBe('page');
    expect(classifyTemariosehsUrl('https://temariosehs.com/temarios/')).toBe('categoria');
  });
  it('parseCourse saca nombre del title', () => {
    expect(parseTemariosehsCourse('https://temariosehs.com/x/', '<title>Temario Auxiliar Ayuntamiento de Córdoba | Temarios EHS</title>')!.rawName)
      .toBe('Auxiliar Ayuntamiento de Córdoba');
  });
});

describe('oposicionesflou', () => {
  it('classifyUrl marca solo /preparar/ como oposición', () => {
    expect(classifyFlouUrl('https://oposicionesflou.com/educacion/oposiciones-educacion-primaria/preparar/')).toBe('oposicion');
    expect(classifyFlouUrl('https://oposicionesflou.com/educacion/oposiciones-educacion-primaria/academia/')).toBe('page');
    expect(classifyFlouUrl('https://oposicionesflou.com/educacion/oposiciones-educacion-primaria/')).toBe('categoria');
  });
  it('parseCourse nombra desde el slug de la oposición', () => {
    expect(parseFlouCourse('https://oposicionesflou.com/educacion/oposiciones-educacion-primaria/preparar/', '')!.rawName)
      .toBe('Educacion Primaria');
  });
});

describe('superaoposiciones', () => {
  it('classifyUrl distingue hoja local/familia de categoría', () => {
    expect(classifySuperaUrl('https://www.superaoposiciones.es/oposiciones-administracion/locales/oposiciones-madrid/auxiliar-administrativo-ayuntamiento')).toBe('oposicion');
    expect(classifySuperaUrl('https://www.superaoposiciones.es/oposiciones-justicia/auxilio')).toBe('oposicion');
    expect(classifySuperaUrl('https://www.superaoposiciones.es/oposiciones-administracion')).toBe('categoria');
    expect(classifySuperaUrl('https://www.superaoposiciones.es/blog/algo')).toBe('post');
  });
});

describe('mad', () => {
  it('classifyUrl: taxonomía = oposición, .html = página', () => {
    expect(classifyMadUrl('https://mad.es/oposiciones/seguridad/policia-nacional/')).toBe('oposicion');
    expect(classifyMadUrl('https://mad.es/oposiciones/educacion/')).toBe('categoria');
    expect(classifyMadUrl('https://mad.es/cuerpo-tecnico/102-tecnicos-9788414239193.html')).toBe('page');
  });
});

describe('opositas', () => {
  it('classifyUrl: 2 segmentos = oposición, 1 = categoría', () => {
    expect(classifyOpositasUrl('https://www.opositas.com/oposiciones/oposiciones-de-justicia/auxilio-judicial/')).toBe('oposicion');
    expect(classifyOpositasUrl('https://www.opositas.com/oposiciones/entidades-locales/')).toBe('categoria');
    expect(classifyOpositasUrl('https://www.opositas.com/preparacion/algo/')).toBe('page');
  });
  it('parseCourse limpia el prefijo "Oposiciones"', () => {
    expect(parseOpositasCourse('https://www.opositas.com/x/', '<title>Oposiciones Auxiliar Administrativo Ayuntamiento de Valencia</title>')!.rawName)
      .toBe('Auxiliar Administrativo Ayuntamiento de Valencia');
  });
});

describe('adams', () => {
  it('classifyUrl: /producto/oposiciones/ = oposición', () => {
    expect(classifyAdamsUrl('https://www.adams.es/producto/oposiciones/interior/ayudantes-138/')).toBe('oposicion');
    expect(classifyAdamsUrl('https://www.adams.es/producto/libros/x-1/')).toBe('page');
  });
  it('parseCourse extrae name + price del JSON-LD', () => {
    const html = `<script type="application/ld+json">{"@type":"Course","name":"Oposiciones de Ayudante de Instituciones Penitenciarias","offers":{"@type":"Offer","price":"1359","priceCurrency":"EUR"}}</script>`;
    const c = parseAdamsCourse('https://www.adams.es/producto/oposiciones/interior/ayudantes-138/', html)!;
    expect(c.rawName).toBe('Oposiciones de Ayudante de Instituciones Penitenciarias');
    expect(c.prices[0]).toMatchObject({ kind: 'curso', amountCents: 135900, period: 'unico' });
  });
  it('parseAdamsJsonLd tolera JSON malformado', () => {
    expect(parseAdamsJsonLd('<script type="application/ld+json">{roto</script>')).toEqual({ name: '', priceCents: null });
  });
});

describe('gokoan', () => {
  it('classifyUrl: hoja vs categoría vs esquemas', () => {
    expect(classifyGokoanUrl('https://www.gokoan.com/oposiciones/auxiliar-administrativo-estado')).toBe('oposicion');
    expect(classifyGokoanUrl('https://www.gokoan.com/oposiciones-autonomicas-andalucia/administrativo')).toBe('oposicion');
    expect(classifyGokoanUrl('https://www.gokoan.com/oposiciones-autonomicas-andalucia')).toBe('categoria');
    expect(classifyGokoanUrl('https://www.gokoan.com/esquemas-oposiciones/x')).toBe('page');
  });
  it('parseCourse quita el prefijo "▷ Oposiciones"', () => {
    expect(parseGokoanCourse('https://www.gokoan.com/oposiciones/x', '<title>▷ Oposiciones Auxiliar Administrativo del Estado</title>')!.rawName)
      .toBe('Auxiliar Administrativo del Estado');
  });
});
