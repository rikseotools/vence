import { classifyTemariosoficialesUrl, parseTemariosoficialesCourse } from './temariosoficiales';

describe('temariosoficiales adapter', () => {
  describe('classifyUrl', () => {
    it('distingue producto (oposición), categoría y página', () => {
      expect(
        classifyTemariosoficialesUrl('https://temariosoficiales.com/product/tecnicos-auxiliares-de-informatica-de-la-administracion-del-estado/'),
      ).toBe('oposicion');
      expect(classifyTemariosoficialesUrl('https://temariosoficiales.com/product-category/estado/')).toBe('categoria');
      expect(classifyTemariosoficialesUrl('https://temariosoficiales.com/carrito/')).toBe('page');
      expect(classifyTemariosoficialesUrl('nope')).toBe('other');
    });
  });

  describe('parseCourse', () => {
    it('saca el nombre del <title> quitando el guión de marca vacío', () => {
      const html = '<title>Técnicos Auxiliares de Informática de la Administración del Estado -</title>';
      const c = parseTemariosoficialesCourse(
        'https://temariosoficiales.com/product/tecnicos-auxiliares-de-informatica-de-la-administracion-del-estado/',
        html,
      )!;
      expect(c.rawName).toBe('Técnicos Auxiliares de Informática de la Administración del Estado');
      expect(c.prices).toEqual([]);
    });

    it('captura el precio del JSON-LD Product (WooCommerce) como material/único', () => {
      const html =
        '<title>Auxiliar Administrativo del Estado -</title>' +
        '<script type="application/ld+json">{"@type":"Product","name":"x","offers":{"@type":"Offer","price":"95","priceCurrency":"EUR"}}</script>';
      const c = parseTemariosoficialesCourse('https://temariosoficiales.com/product/auxiliar-administrativo-del-estado/', html)!;
      expect(c.rawName).toBe('Auxiliar Administrativo del Estado');
      expect(c.prices).toEqual([{ kind: 'material', audience: null, amountCents: 9500, period: 'unico', raw: '95€' }]);
    });

    it('sin título ni JSON-LD → cae al slug y prices vacío', () => {
      const c = parseTemariosoficialesCourse('https://temariosoficiales.com/product/celador-sescam/', '<html></html>')!;
      expect(c.rawName).toBe('Celador Sescam');
      expect(c.prices).toEqual([]);
    });
  });
});
