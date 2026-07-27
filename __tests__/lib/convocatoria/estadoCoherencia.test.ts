// __tests__/lib/convocatoria/estadoCoherencia.test.ts — núcleo PURO de coherencia estado ↔ fechas.
//
// La lógica llevaba desde el 18/06 dentro de `scripts/audit-estados-convocatoria.cjs` SIN tests:
// se validaba mirando su salida a ojo. Al extraerla para que alimente también el badge, se fija
// aquí su comportamiento, incluidos los casos reales que la motivaron.

import { detectarIncoherenciasEstado, abiertaPorFechas, hoyMadrid } from '@/lib/convocatoria/estadoCoherencia'

const HOY = '2026-07-27'
const reglas = (o: Record<string, unknown>, hoy = HOY) =>
  detectarIncoherenciasEstado(o as never, hoy).map((i) => i.regla)
const sev = (o: Record<string, unknown>, hoy = HOY) =>
  detectarIncoherenciasEstado(o as never, hoy).map((i) => i.severidad)

describe('contradicciones CLARAS (error): el dato es imposible tal cual está', () => {
  it("'inscripcion_abierta' con el plazo ya vencido", () => {
    const o = { is_active: true, estado_proceso: 'inscripcion_abierta', inscription_start: '2026-06-01', inscription_deadline: '2026-07-01' }
    expect(reglas(o)).toContain('abierta_plazo_vencido')
    expect(sev(o)).toContain('error')
  })

  it("'pendiente_examen' con el examen ya celebrado", () => {
    const o = { is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-05-17' }
    expect(reglas(o)).toContain('pendiente_examen_pasado')
  })

  it('…salvo que la fecha esté marcada como APROXIMADA (no es contradicción, es una previsión)', () => {
    const o = { is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-05-17', exam_date_approximate: true }
    expect(reglas(o)).not.toContain('pendiente_examen_pasado')
  })

  it('un estado post-examen con el examen en el futuro', () => {
    expect(reglas({ is_active: true, estado_proceso: 'resultados', exam_date: '2027-01-01' })).toContain('post_examen_futuro')
  })

  it('activa marcada "abierta" pero SIN fechas ⇒ invisible en el front (el front filtra por fechas)', () => {
    const r = reglas({ is_active: true, estado_proceso: 'inscripcion_abierta', inscription_deadline: null })
    expect(r).toContain('abierta_invisible_en_front')
  })
})

describe('sospechas (warn): puede ser legítimo, pero hay que mirarlo', () => {
  it("'inscripcion_abierta' sin fecha de cierre", () => {
    expect(reglas({ is_active: false, estado_proceso: 'inscripcion_abierta' })).toContain('abierta_sin_cierre')
    expect(sev({ is_active: false, estado_proceso: 'inscripcion_abierta' })).toEqual(['warn'])
  })

  it("'convocada' con el plazo ya vencido", () => {
    expect(reglas({ estado_proceso: 'convocada', inscription_deadline: '2026-07-01' })).toContain('convocada_plazo_vencido')
  })

  it("'inscripcion_cerrada' con el plazo aún por vencer", () => {
    expect(reglas({ estado_proceso: 'inscripcion_cerrada', inscription_deadline: '2026-12-31' })).toContain('cerrada_plazo_futuro')
  })

  it('inicio de plazo POSTERIOR al cierre (caso celador-sermas: abría el 7 y cerraba el 6)', () => {
    expect(reglas({ estado_proceso: 'convocada', inscription_start: '2026-08-07', inscription_deadline: '2026-08-06' }))
      .toContain('start_despues_deadline')
  })

  it('abierta por fechas pero con otro estado ⇒ sale en el front igualmente', () => {
    const o = { is_active: true, estado_proceso: 'convocada', inscription_start: '2026-07-01', inscription_deadline: '2026-08-31' }
    expect(reglas(o)).toContain('abierta_por_fechas_otro_estado')
  })

  it('estado vacío se reporta y no evalúa nada más', () => {
    expect(reglas({ is_active: true, estado_proceso: null })).toEqual(['estado_vacio'])
  })
})

describe('catalogadas visibles en el front (is_active=false pero abiertas y con url)', () => {
  const base = { is_active: false, inscription_start: '2026-07-01', inscription_deadline: '2026-08-31', seguimiento_url: 'https://x.es/ficha' }

  it('el radar NUNCA la verificó ⇒ su fecha no tiene garantía', () => {
    expect(reglas({ ...base, estado_proceso: 'inscripcion_abierta' })).toContain('catalogada_sin_verificar')
  })

  it('el radar lleva más de 30 días sin verificarla ⇒ posible fecha stale', () => {
    expect(reglas({ ...base, estado_proceso: 'inscripcion_abierta', seguimiento_last_checked: '2026-05-01' }))
      .toContain('catalogada_radar_stale')
  })

  it('verificada hace poco ⇒ sin queja', () => {
    expect(reglas({ ...base, estado_proceso: 'inscripcion_abierta', seguimiento_last_checked: '2026-07-25' })).toEqual([])
  })

  it('sin seguimiento_url NO es visible en el front ⇒ no se le exige nada', () => {
    expect(reglas({ ...base, seguimiento_url: null, estado_proceso: 'convocada' })).toEqual([])
  })
})

describe('lo coherente NO genera ruido (evitar el detector que grita siempre)', () => {
  it.each([
    ['abierta de verdad', { is_active: true, estado_proceso: 'inscripcion_abierta', inscription_start: '2026-07-01', inscription_deadline: '2026-08-31' }],
    ['examen futuro pendiente', { is_active: true, estado_proceso: 'pendiente_examen', exam_date: '2026-11-20' }],
    ['resultados con examen pasado', { is_active: true, estado_proceso: 'resultados', exam_date: '2026-05-17' }],
    ['oep aprobada sin fechas', { is_active: true, estado_proceso: 'oep_aprobada' }],
  ])('%s ⇒ sin incidencias', (_caso, o) => {
    expect(detectarIncoherenciasEstado(o as never, HOY)).toEqual([])
  })
})

describe('utilidades', () => {
  it('abiertaPorFechas exige AMBAS fechas y que hoy esté dentro', () => {
    expect(abiertaPorFechas({ inscription_start: '2026-07-01', inscription_deadline: '2026-08-31' } as never, HOY)).toBe(true)
    expect(abiertaPorFechas({ inscription_start: '2026-08-01', inscription_deadline: '2026-08-31' } as never, HOY)).toBe(false)
    expect(abiertaPorFechas({ inscription_start: '2026-07-01' } as never, HOY)).toBe(false)
  })

  it('tolera timestamps completos, no solo YYYY-MM-DD', () => {
    const o = { is_active: true, estado_proceso: 'inscripcion_abierta', inscription_start: '2026-06-01T00:00:00.000Z', inscription_deadline: '2026-07-01T00:00:00.000Z' }
    expect(reglas(o)).toContain('abierta_plazo_vencido')
  })

  it('hoyMadrid da YYYY-MM-DD (y en Madrid, no en UTC: de madrugada NO es el día anterior)', () => {
    expect(hoyMadrid()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 00:30 de Madrid en verano = 22:30 UTC del día ANTERIOR. Debe devolver el día de Madrid.
    expect(hoyMadrid(new Date('2026-07-27T22:30:00Z'))).toBe('2026-07-28')
  })
})
