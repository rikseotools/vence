import {
  looksLikeC1C2Convocatoria,
  extractCandidatesFromSumarioText,
  collectBoeTitulos,
  htmlToText,
} from './boletines';

// Caso real que motivó el sensor (BOCYL 17/06/2026, BOCYL-D-17062026-115-10).
const ULE_ADMIN =
  'RESOLUCIÓN de 15 de junio de 2026, del Rectorado de la Universidad de León, por la que se convoca proceso selectivo para el ingreso, por el sistema general de acceso libre, en la Escala Administrativa de la Universidad de León.';

describe('looksLikeC1C2Convocatoria', () => {
  it('detecta la convocatoria de ingreso C1/C2 (caso ULE Escala Administrativa)', () => {
    expect(looksLikeC1C2Convocatoria(ULE_ADMIN)).toBe(true);
  });

  it('detecta una Escala Auxiliar de ingreso', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución de la UNED por la que se convocan pruebas selectivas para ingreso en la Escala de Auxiliares Administrativos.',
      ),
    ).toBe(true);
  });

  it('descarta listas de resultados (relación de aspirantes que han superado)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'RESOLUCIÓN por la que se publica la relación de aspirantes que han superado el proceso selectivo de Auxiliar Administrativo.',
      ),
    ).toBe(false);
  });

  it('descarta cuerpos A1/A2 y docentes (catedráticos, titulado superior)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca proceso selectivo para ingreso en el Cuerpo de Catedráticos de Universidad.',
      ),
    ).toBe(false);
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convocan pruebas selectivas de Titulado Superior, subgrupo A1.',
      ),
    ).toBe(false);
  });

  it('descarta provisión por libre designación (no es ingreso)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca la provisión de puesto de trabajo de Administrativo por el sistema de libre designación.',
      ),
    ).toBe(false);
  });

  it('descarta ruido no funcionarial (apartamentos de estudiantes, vías pecuarias)', () => {
    expect(
      looksLikeC1C2Convocatoria(
        'Resolución por la que se convoca concurso para la adjudicación de plazas en los apartamentos para estudiantes.',
      ),
    ).toBe(false);
    expect(
      looksLikeC1C2Convocatoria(
        'ORDEN por la que se aprueba la clasificación de las vías pecuarias del término municipal.',
      ),
    ).toBe(false);
  });
});

describe('extractCandidatesFromSumarioText', () => {
  it('separa disposiciones y deja solo las convocatorias C1/C2', () => {
    const sumario = [
      ULE_ADMIN,
      'RESOLUCIÓN por la que se publica la relación de aspirantes que han superado el proceso selectivo.',
      'ORDEN PRE/548/2026, de 10 de junio, por la que se convoca la constitución de la bolsa de empleo temporal del Cuerpo de Gestión Económico-Financiera.',
      'RESOLUCIÓN por la que se convoca proceso selectivo para ingreso en el Cuerpo de Catedráticos de Universidad.',
    ].join(' ');
    const hits = extractCandidatesFromSumarioText(sumario);
    expect(hits.some((h) => /Escala Administrativa de la Universidad de León/.test(h))).toBe(true);
    expect(hits.some((h) => /Cuerpo de Gestión Económico-Financiera/.test(h))).toBe(true);
    // ni resultados ni catedráticos
    expect(hits.some((h) => /aspirantes que han superado/.test(h))).toBe(false);
    expect(hits.some((h) => /Catedráticos/.test(h))).toBe(false);
  });
});

describe('collectBoeTitulos', () => {
  it('recoge recursivamente todos los campos titulo del JSON del sumario BOE', () => {
    const json = {
      data: {
        sumario: {
          diario: [
            {
              seccion: [
                {
                  nombre: 'II.B Oposiciones y concursos',
                  item: [{ titulo: ULE_ADMIN, url_pdf: '/x.pdf' }],
                },
              ],
            },
          ],
        },
      },
    };
    const titulos = collectBoeTitulos(json);
    expect(titulos).toContain(ULE_ADMIN);
  });
});

describe('htmlToText', () => {
  it('limpia tags y decodifica entidades acentuadas', () => {
    expect(htmlToText('<p>Resoluci&oacute;n de la <b>Administraci&oacute;n</b></p>')).toBe(
      'Resolución de la Administración',
    );
  });
});
