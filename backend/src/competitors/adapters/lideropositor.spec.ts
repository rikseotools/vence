import { classifyLiderUrl, parseLiderCourse } from './lideropositor';

describe('lideropositor adapter', () => {
  describe('classifyUrl', () => {
    it('hoja (≥2 segmentos) = oposición; 0-1 = categoría', () => {
      expect(classifyLiderUrl('https://lideropositor.com/web/oposiciones/fuerzas-y-cuerpos-de-seguridad/guardia-civil/')).toBe('oposicion');
      expect(classifyLiderUrl('https://lideropositor.com/web/oposiciones/oposiciones-andalucia/junta-de-andalucia/administrativo/')).toBe('oposicion');
      expect(classifyLiderUrl('https://lideropositor.com/web/oposiciones/fuerzas-y-cuerpos-de-seguridad/')).toBe('categoria');
      expect(classifyLiderUrl('https://lideropositor.com/web/oposiciones/')).toBe('categoria');
      expect(classifyLiderUrl('https://lideropositor.com/web/contacto/')).toBe('page');
    });
  });

  describe('parseCourse', () => {
    it('saca el nombre del <title> "Oposiciones a X en Málaga"', () => {
      const html = '<title>Oposiciones a Guardia Civil en Málaga - Líder Opositor</title>';
      const c = parseLiderCourse('https://lideropositor.com/web/oposiciones/fuerzas-y-cuerpos-de-seguridad/guardia-civil/', html)!;
      expect(c.rawName).toBe('Guardia Civil');
      expect(c.prices).toEqual([]);
    });

    it('cae al slug de la hoja si el título no encaja', () => {
      const c = parseLiderCourse('https://lideropositor.com/web/oposiciones/oposiciones-andalucia/junta-de-andalucia/auxiliar-administrativo/', '<title>Otra cosa</title>')!;
      expect(c.rawName).toBe('Auxiliar Administrativo');
    });
  });
});
