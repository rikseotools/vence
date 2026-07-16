import { fechasCuadran, reconciliar, hitosValidos, buildProcesoPrompt, type ProcesoExtraction } from './proceso-extract';

// Caso REAL: Administrativo Comunidad de Madrid. Marta Benito reportó que mostrábamos nov-2027;
// las bases (BOCM, Orden 1634/2026, base 9) dicen "mayo de 2027".
const CITA_BASE_9 = 'La celebración del primer ejercicio se realizará en mayo de 2027';

const ext = (o: Partial<ProcesoExtraction> = {}): ProcesoExtraction => ({
  fecha_examen: '2027-05',
  plazas_libres: null,
  plazas_promocion_interna: null,
  hitos: [{ tipo: 'ejercicio_1', fecha: '2027-05', cita_literal: CITA_BASE_9 }],
  confianza: 'alta',
  ...o,
});

describe('fechasCuadran — precisión asimétrica', () => {
  test('el documento solo da el MES → se compara a nivel mes (no día)', () => {
    // nuestra fecha aproximada al 1-may vs "mayo de 2027" → CUADRA
    expect(fechasCuadran('2027-05-01', '2027-05')).toBe(true);
    expect(fechasCuadran('2027-05-28', '2027-05')).toBe(true);
    expect(fechasCuadran('2027-11-15', '2027-05')).toBe(false);
  });

  test('el documento da el DÍA → se compara a nivel día', () => {
    expect(fechasCuadran('2027-05-01', '2027-05-01')).toBe(true);
    expect(fechasCuadran('2027-05-02', '2027-05-01')).toBe(false);
  });

  test('sin fecha en BD no cuadra (es cobertura, no coincidencia)', () => {
    expect(fechasCuadran(null, '2027-05')).toBe(false);
  });
});

describe('reconciliar — el caso Marta', () => {
  test('EL BUG: mostrábamos nov-2027 y la base 9 dice mayo → hallazgo con la cita', () => {
    const d = reconciliar(ext(), { exam_date: '2027-11-15', plazas_libres: null, plazas_promocion_interna: null });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ campo: 'exam_date', db: '2027-11-15', oficial: '2027-05', severidad: 'error' });
    expect(d[0].cita).toBe(CITA_BASE_9);   // el hallazgo trae la evidencia, no una opinión
  });

  test('YA CORREGIDO: mostramos may-2027 aproximado → NO chilla (aproximado ≠ incorrecto)', () => {
    expect(reconciliar(ext(), { exam_date: '2027-05-01', plazas_libres: null, plazas_promocion_interna: null })).toHaveLength(0);
  });

  test('sin fecha en BD → warn de cobertura, no error de contradicción', () => {
    const d = reconciliar(ext(), { exam_date: null, plazas_libres: null, plazas_promocion_interna: null });
    expect(d[0]).toMatchObject({ campo: 'exam_date', db: null, severidad: 'warn' });
  });
});

describe('reconciliar — guardarraíles anti-falso-positivo', () => {
  test('confianza media/baja NO genera hallazgo (el ruido es como se llegó a Marta)', () => {
    for (const c of ['media', 'baja'] as const) {
      expect(reconciliar(ext({ confianza: c }), { exam_date: '2027-11-15', plazas_libres: null, plazas_promocion_interna: null })).toHaveLength(0);
    }
  });

  test('sin cita literal NO hay hallazgo, aunque el dato venga', () => {
    const sinCita = ext({ hitos: [{ tipo: 'ejercicio_1', fecha: '2027-05', cita_literal: '' }] });
    expect(reconciliar(sinCita, { exam_date: '2027-11-15', plazas_libres: null, plazas_promocion_interna: null })).toHaveLength(0);
  });

  test('plazas: contradicción con cita → error; sin cita → nada', () => {
    const conCita = ext({ plazas_libres: 107, hitos: [{ tipo: 'convocatoria_publicada', fecha: '2026-07-14', cita_literal: 'se convocan 107 plazas del Cuerpo Administrativo' }] });
    const d = reconciliar(conCita, { exam_date: null, plazas_libres: 44, plazas_promocion_interna: null });
    expect(d.find((x) => x.campo === 'plazas_libres')).toMatchObject({ db: '44', oficial: '107', severidad: 'error' });

    const sinCita = ext({ plazas_libres: 107, hitos: [] });
    expect(reconciliar(sinCita, { exam_date: null, plazas_libres: 44, plazas_promocion_interna: null })).toHaveLength(0);
  });

  test('NUNCA devuelve un cambio, solo descuadres (no auto-flip)', () => {
    const d = reconciliar(ext(), { exam_date: '2027-11-15', plazas_libres: null, plazas_promocion_interna: null });
    expect(Object.keys(d[0]).sort()).toEqual(['campo', 'cita', 'db', 'oficial', 'severidad']);
  });
});

describe('hitosValidos — el LLM no inventa el modelo', () => {
  test('descarta tipo fuera del vocabulario, fecha mal formada y sin cita', () => {
    const r = hitosValidos([
      { tipo: 'ejercicio_1', fecha: '2027-05', cita_literal: CITA_BASE_9 },
      { tipo: 'fase_de_concurso_inventada', fecha: '2027-05-01', cita_literal: 'x' },
      { tipo: 'plazo_fin', fecha: 'mayo de 2027', cita_literal: 'x' },
      { tipo: 'plazo_inicio', fecha: '2026-07-15', cita_literal: '   ' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('ejercicio_1');
  });
});

describe('buildProcesoPrompt', () => {
  test('prohíbe deducir y exige cita literal + vocabulario cerrado', () => {
    const p = buildProcesoPrompt('administrativo-madrid', [{ titulo: 'Bases', texto: 'texto' }]);
    expect(p).toMatch(/NO deduzcas, NO estimes/);
    expect(p).toMatch(/Sin cita, no lo incluyas/);
    expect(p).toMatch(/NO inventes el día/);
    expect(p).toMatch(/ejercicio_1/);
  });
});
