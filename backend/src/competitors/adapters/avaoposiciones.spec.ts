import { classifyAvaUrl, parseAvaCourse } from './avaoposiciones';

describe('avaoposiciones adapter', () => {
  describe('classifyUrl', () => {
    it('distingue curso, categoría y página', () => {
      expect(classifyAvaUrl('https://avaoposiciones.net/course/auxiliar-administrativo-ayuntamiento-de-cordoba/')).toBe('oposicion');
      expect(classifyAvaUrl('https://avaoposiciones.net/course-category/autonomicas/')).toBe('categoria');
      expect(classifyAvaUrl('https://avaoposiciones.net/2026/05/nota/')).toBe('post');
      expect(classifyAvaUrl('https://avaoposiciones.net/contacto/')).toBe('page');
      expect(classifyAvaUrl('nope')).toBe('other');
    });
  });

  describe('parseCourse', () => {
    it('deriva el nombre del slug (el h1 es genérico) con stopwords en minúscula', () => {
      const c = parseAvaCourse('https://avaoposiciones.net/course/auxiliar-administrativo-ayuntamiento-de-cordoba/', '<h1>AUTONÓMICAS</h1>')!;
      expect(c.rawName).toBe('Auxiliar Administrativo Ayuntamiento de Cordoba');
    });

    it('no publica precios → prices vacío', () => {
      const c = parseAvaCourse('https://avaoposiciones.net/course/administrativo-ja/', '<html></html>')!;
      expect(c.prices).toEqual([])
      expect(c.rawName).toBe('Administrativo Ja')
    });
  });
});
