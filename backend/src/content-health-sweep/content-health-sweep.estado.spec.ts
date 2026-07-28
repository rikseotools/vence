// Paridad de COMPORTAMIENTO del mirror `detectarIncoherenciasEstado` del backend.
//
// `__tests__/health/content-sweep-parity.test.ts` (raíz) garantiza que los dos gemelos emiten los
// mismos KINDS, pero no que decidan igual: el backend no puede importar el núcleo del root
// (`lib/convocatoria/estadoCoherencia.cjs`) porque es otro proyecto, así que la lógica está
// replicada a mano. Sin este spec, el mirror podría derivar en silencio y el @Cron nocturno —que
// es el writer REAL del badge— publicaría hallazgos distintos de los del CLI.
//
// Los casos son los MISMOS que en `__tests__/lib/convocatoria/estadoCoherencia.test.ts`.
// Si tocas una implementación, toca la otra y los dos tests deben seguir en verde.

import { detectarIncoherenciasEstado } from './content-health-sweep.service';

const HOY = '2026-07-27';
const reglas = (o: Record<string, unknown>) => detectarIncoherenciasEstado(o, HOY).map((i) => i.regla);

describe('mirror estado ↔ fechas (backend @Cron) — mismos veredictos que el núcleo del root', () => {
  it("'inscripcion_abierta' con plazo vencido ⇒ error", () => {
    const o = { is_active: true, estado_proceso: 'inscripcion_abierta', inscription_start: '2026-06-01', inscription_deadline: '2026-07-01' };
    expect(reglas(o)).toContain('abierta_plazo_vencido');
    expect(detectarIncoherenciasEstado(o, HOY)[0].severidad).toBe('error');
  });

  it("'pendiente_examen' con examen pasado ⇒ error, salvo fecha aproximada", () => {
    expect(reglas({ is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-05-17' })).toContain('pendiente_examen_pasado');
    expect(reglas({ is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-05-17', exam_date_approximate: true })).not.toContain('pendiente_examen_pasado');
  });

  it('post-examen con examen futuro ⇒ error', () => {
    expect(reglas({ is_active: true, estado_proceso: 'resultados', exam_date: '2027-01-01' })).toContain('post_examen_futuro');
  });

  it('activa "abierta" sin fechas ⇒ invisible en el front', () => {
    expect(reglas({ is_active: true, estado_proceso: 'inscripcion_abierta' })).toContain('abierta_invisible_en_front');
  });

  it('inicio posterior al cierre ⇒ warn', () => {
    expect(reglas({ estado_proceso: 'convocada', inscription_start: '2026-08-07', inscription_deadline: '2026-08-06' })).toContain('start_despues_deadline');
  });

  it('abierta por fechas con otro estado ⇒ warn', () => {
    expect(reglas({ is_active: true, estado_proceso: 'convocada', inscription_start: '2026-07-01', inscription_deadline: '2026-08-31' })).toContain('abierta_por_fechas_otro_estado');
  });

  it('catalogada visible: sin verificar y radar stale', () => {
    const base = { is_active: false, inscription_start: '2026-07-01', inscription_deadline: '2026-08-31', seguimiento_url: 'https://x.es/f', estado_proceso: 'inscripcion_abierta' };
    expect(reglas(base)).toContain('catalogada_sin_verificar');
    expect(reglas({ ...base, seguimiento_last_checked: '2026-05-01' })).toContain('catalogada_radar_stale');
    expect(reglas({ ...base, seguimiento_last_checked: '2026-07-25' })).toEqual([]);
  });

  it('estado vacío corta la evaluación', () => {
    expect(reglas({ is_active: true, estado_proceso: null })).toEqual(['estado_vacio']);
  });

  // Regla 5.bis (T-211, caso Cádiz): estado post-examen vs. referencia de boletín.
  it('CASO CÁDIZ: post-examen sin fecha de examen y con referencia del año en curso ⇒ warn', () => {
    const o = {
      is_active: true,
      estado_proceso: 'examen_realizado',
      exam_date: null,
      boe_reference: 'BOP Cádiz nº 28, de 11/02/2026 (44 plz; extracto BOE de apertura de plazo pendiente)',
    };
    expect(reglas(o)).toContain('post_examen_sin_fecha_ref_actual');
    expect(detectarIncoherenciasEstado(o, HOY)[0].severidad).toBe('warn');
  });

  it('convocatoria publicada DESPUÉS del examen dado por celebrado ⇒ error', () => {
    const o = { is_active: true, estado_proceso: 'examen_realizado', exam_date: '2026-06-06', boe_publication_date: '2026-07-01' };
    expect(reglas(o)).toContain('post_examen_convocatoria_posterior');
    expect(detectarIncoherenciasEstado(o, HOY)[0].severidad).toBe('error');
  });

  it('examen viejo con referencia de boletín posterior ⇒ warn', () => {
    expect(reglas({ is_active: true, estado_proceso: 'resultados', exam_date: '2024-05-11', boe_reference: 'BOP nº 28, de 11/02/2026' }))
      .toContain('post_examen_ref_posterior');
  });

  it.each([
    ['abierta de verdad', { is_active: true, estado_proceso: 'inscripcion_abierta', inscription_start: '2026-07-01', inscription_deadline: '2026-08-31' }],
    ['examen futuro pendiente', { is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-11-20' }],
    ['oep aprobada sin fechas', { is_active: true, estado_proceso: 'oep_aprobada' }],
    ['convocatoria y examen del mismo año', { is_active: true, estado_proceso: 'examen_realizado', exam_date: '2026-05-17', boe_publication_date: '2026-01-20', boe_reference: 'BOE núm. 18, de 20/01/2026' }],
    ['post-examen con referencia VIEJA y sin fecha', { is_active: true, estado_proceso: 'nombramientos', boe_reference: 'BOE núm. 45, de 21/02/2023' }],
  ])('%s ⇒ sin incidencias (no gritar sin motivo)', (_c, o) => {
    expect(detectarIncoherenciasEstado(o as Record<string, unknown>, HOY)).toEqual([]);
  });
});
