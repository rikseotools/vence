import {
  classifyTecnoszubiaUrl,
  euroToCents,
  parseTecnoszubiaCourse,
} from './tecnoszubia';

describe('tecnoszubia adapter', () => {
  describe('euroToCents', () => {
    it('parsea formato español (miles y decimales)', () => {
      expect(euroToCents('120€')).toBe(12000);
      expect(euroToCents('60 €')).toBe(6000);
      expect(euroToCents('15,57 €')).toBe(1557);
      expect(euroToCents('1.500 €')).toBe(150000);
      expect(euroToCents('sin precio')).toBeNull();
    });
  });

  describe('classifyUrl', () => {
    it('distingue curso, categoría y página', () => {
      expect(
        classifyTecnoszubiaUrl('https://www.tecnoszubia.es/oposiciones/policia-local/'),
      ).toBe('oposicion');
      expect(
        classifyTecnoszubiaUrl('https://www.tecnoszubia.es/oposicion/administracion/'),
      ).toBe('categoria');
      // El listado /oposiciones/ (sin slug) NO es un curso.
      expect(classifyTecnoszubiaUrl('https://www.tecnoszubia.es/oposiciones/')).toBe('page');
      expect(classifyTecnoszubiaUrl('https://www.tecnoszubia.es/contacto/')).toBe('page');
      expect(classifyTecnoszubiaUrl('no-es-url')).toBe('other');
    });
  });

  describe('parseCourse', () => {
    // Fixture fiel al markup real de tecnoszubia (sondeado 06/07/2026):
    // matrícula tachada + tabla cuota + tabla intensivo de verano + tasa.
    const html = `
      <h1 class="entry-title">Oposiciones Administrativo del Estado</h1>
      <p>Curso <strong>presencial</strong> y también <strong>online</strong> en directo.</p>
      <p><strong><span style="color: #3366ff">Precio de matrícula 26/27: <del>120€</del> 60€</span></strong></p>
      <table style="width:100%">
        <thead><tr><th>Comienzo en</th><th>Septiembre</th></tr></thead>
        <tbody>
          <tr><td><strong>Nuevos alumnos</strong></td><td>125€</td></tr>
          <tr><td><strong>Antiguos alumnos</strong></td><td>105€</td></tr>
        </tbody>
      </table>
      <p>El intensivo abarcará los meses de junio, julio y agosto y tendrá un precio reducido.</p>
      <table style="width:100%">
        <tbody>
          <tr><td><strong>Nuevos alumnos</strong></td><td>60€</td></tr>
          <tr><td><strong>Antiguos alumnos</strong></td><td>50€</td></tr>
        </tbody>
      </table>
      <ul><li><strong>Tasa de examen</strong>: 15,57 €, con exenciones.</li></ul>
      <p>El sueldo de un Administrativo (C1) se sitúa entre 1.500 € y 1.900 € brutos al mes.</p>
    `;

    const course = parseTecnoszubiaCourse(
      'https://www.tecnoszubia.es/oposiciones/oposiciones-administrativo-del-estado/',
      html,
    )!;

    it('extrae nombre y modalidad', () => {
      expect(course.rawName).toBe('Oposiciones Administrativo del Estado');
      expect(course.modalidad).toBe('mixta');
    });

    it('extrae la matrícula vigente (fuera del tachado)', () => {
      const mat = course.prices.find((p) => p.kind === 'matricula')!;
      expect(mat.amountCents).toBe(6000); // 60€ vigente, no 120€ tachado
      expect(mat.period).toBe('unico');
      expect(mat.raw).toContain('120€ (antes)');
    });

    it('extrae cuota mensual (nuevos/antiguos)', () => {
      const cuota = course.prices.filter((p) => p.kind === 'cuota');
      expect(cuota).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ audience: 'nuevo', amountCents: 12500, period: 'mensual' }),
          expect.objectContaining({ audience: 'antiguo', amountCents: 10500, period: 'mensual' }),
        ]),
      );
    });

    it('clasifica la 2ª tabla como intensivo por el contexto de verano', () => {
      const intensivo = course.prices.filter((p) => p.kind === 'intensivo');
      expect(intensivo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ audience: 'nuevo', amountCents: 6000 }),
          expect.objectContaining({ audience: 'antiguo', amountCents: 5000 }),
        ]),
      );
    });

    it('extrae la tasa de examen', () => {
      const tasa = course.prices.find((p) => p.kind === 'tasa')!;
      expect(tasa.amountCents).toBe(1557);
    });

    it('NO se traga el sueldo del cuerpo del artículo como precio', () => {
      // 1.500 € / 1.900 € son sueldo, no precios del curso.
      expect(course.prices.some((p) => p.amountCents === 150000)).toBe(false);
      expect(course.prices.some((p) => p.amountCents === 190000)).toBe(false);
    });
  });
});
