import {
  classifyOpositatestUrl,
  parseOpositatestCourse,
} from './opositatest';

describe('opositatest adapter', () => {
  describe('classifyUrl', () => {
    it('distingue producto (curso), categoría y página', () => {
      expect(classifyOpositatestUrl('https://www.opositatest.com/productos/curso-de-auxilio-judicial')).toBe('oposicion');
      expect(classifyOpositatestUrl('https://www.opositatest.com/oposiciones/categorias/hacienda')).toBe('categoria');
      expect(classifyOpositatestUrl('https://www.opositatest.com/tests-gratis')).toBe('page');
      expect(classifyOpositatestUrl('no-url')).toBe('other');
    });
  });

  describe('parseCourse', () => {
    it('extrae y limpia el nombre del h1 server-rendered', () => {
      const html = `<h1 class='xxxl-text-font'>Curso de Auxilio Judicial - Preparación integral actualizado a 2026</h1>`;
      const c = parseOpositatestCourse('https://www.opositatest.com/productos/curso-de-auxilio-judicial', html)!;
      expect(c.rawName).toBe('Auxilio Judicial');
      expect(c.modalidad).toBe('online');
    });

    it('deja precios vacíos (suscripción dinámica, no se inventa)', () => {
      const c = parseOpositatestCourse('https://www.opositatest.com/productos/x', '<h1>Curso de X</h1>')!;
      expect(c.prices).toEqual([]);
    });

    it('cae al slug si no hay h1', () => {
      const c = parseOpositatestCourse('https://www.opositatest.com/productos/curso-de-tramitacion-procesal-tl', '<div>sin h1</div>')!;
      expect(c.rawName.toLowerCase()).toContain('tramitacion');
    });
  });
});
