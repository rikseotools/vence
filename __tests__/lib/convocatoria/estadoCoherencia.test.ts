// __tests__/lib/convocatoria/estadoCoherencia.test.ts — núcleo PURO de coherencia estado ↔ fechas.
//
// La lógica llevaba desde el 18/06 dentro de `scripts/audit-estados-convocatoria.cjs` SIN tests:
// se validaba mirando su salida a ojo. Al extraerla para que alimente también el badge, se fija
// aquí su comportamiento, incluidos los casos reales que la motivaron.

import { detectarIncoherenciasEstado, abiertaPorFechas, hoyMadrid, anioMaxCitado } from '@/lib/convocatoria/estadoCoherencia'

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

// El punto ciego que destapó Cádiz (T-211): TODAS las reglas de arriba comparan fechas de
// convocatoria entre sí. Aquí la contradicción es entre el ESTADO y la referencia de boletín,
// y por eso 164 usuarios veían "examen realizado" sobre una convocatoria recién publicada.
describe('estado post-examen contra la REFERENCIA DE BOLETÍN', () => {
  it('CASO CÁDIZ: post-examen, sin fecha de examen y con referencia del año en curso ⇒ warn', () => {
    const o = {
      is_active: true,
      estado_proceso: 'examen_realizado',
      exam_date: null,
      boe_reference: 'BOP Cádiz nº 28, de 11/02/2026 (44 plz; extracto BOE de apertura de plazo pendiente)',
    }
    expect(reglas(o)).toContain('post_examen_sin_fecha_ref_actual')
    expect(sev(o)).toEqual(['warn'])
  })

  it('la convocatoria publicada DESPUÉS del examen que se da por celebrado ⇒ error', () => {
    const o = {
      is_active: true,
      estado_proceso: 'examen_realizado',
      exam_date: '2026-06-06',
      boe_publication_date: '2026-07-01',
    }
    expect(reglas(o)).toContain('post_examen_convocatoria_posterior')
    expect(sev(o)).toContain('error')
  })

  it('examen de un año y referencia de boletín POSTERIOR ⇒ warn (¿ya es del ciclo siguiente?)', () => {
    const o = { is_active: true, estado_proceso: 'resultados', exam_date: '2024-05-11', boe_reference: 'BOP nº 28, de 11/02/2026' }
    expect(reglas(o)).toContain('post_examen_ref_posterior')
  })

  it.each([
    // Lo NORMAL: proceso terminado este año cuya convocatoria también es de este año.
    ['convocatoria y examen del mismo año', { is_active: true, estado_proceso: 'examen_realizado', exam_date: '2026-05-17', boe_publication_date: '2026-01-20', boe_reference: 'BOE núm. 18, de 20/01/2026' }],
    ['post-examen con referencia VIEJA y sin fecha', { is_active: true, estado_proceso: 'nombramientos', boe_reference: 'BOE núm. 45, de 21/02/2023' }],
    ['estado NO post-examen (convocada) con referencia de este año', { is_active: true, estado_proceso: 'convocada', boe_reference: 'BOP Cádiz nº 28, de 11/02/2026' }],
    ['sin referencia de boletín', { is_active: true, estado_proceso: 'examen_realizado' }],
  ])('%s ⇒ sin incidencias', (_caso, o) => {
    expect(detectarIncoherenciasEstado(o as never, HOY)).toEqual([])
  })

  it('anioMaxCitado se queda con el año MÁS RECIENTE del texto (la OEP vieja no fecha la convocatoria)', () => {
    expect(anioMaxCitado('OEP 2023 (12 plz) + OEP 2024 (16 plz); bases en BOP de 11/02/2026')).toBe(2026)
    expect(anioMaxCitado('BOE-A-2026-9982')).toBe(2026)
    expect(anioMaxCitado('sin años')).toBeNull()
    expect(anioMaxCitado(null)).toBeNull()
    // Un número de 4 cifras que NO es un año (nº de plazas, expediente) no debe colarse.
    expect(anioMaxCitado('convocatoria de 1200 plazas')).toBeNull()
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

describe('degradación por oposición NO ACTIVA (precisión de la banda de error)', () => {
  // Una oposición inactiva es ficha de CATÁLOGO (radar), no landing servida: su estado puede
  // contradecirse con sus fechas sin que ningún opositor lo lea. La incidencia se registra igual
  // —el dato sigue mal— pero baja a `warn`, porque `error` significa "está EN PANTALLA y hay que
  // arreglarlo hoy". Medido el 28/07/2026: los 4 errores vivos del detector eran los 4 de
  // oposiciones inactivas, y el catálogo (~2.500 fichas) los repone cada noche al vencer plazos.
  const vencida = { estado_proceso: 'inscripcion_abierta', inscription_deadline: '2026-07-01' }

  it('ACTIVA con plazo vencido → error (se ve, hay que arreglarlo)', () => {
    expect(sev({ ...vencida, is_active: true })).toContain('error')
  })

  it('NO ACTIVA con el MISMO defecto → warn, no error', () => {
    expect(sev({ ...vencida, is_active: false })).not.toContain('error')
    expect(sev({ ...vencida, is_active: false })).toContain('warn')
  })

  it('la incidencia NO desaparece: sigue detectándose, solo cambia la severidad', () => {
    expect(reglas({ ...vencida, is_active: false })).toContain('abierta_plazo_vencido')
  })

  it('sin el campo `is_active` NO degrada: un dato ausente no apaga una alarma en silencio', () => {
    expect(sev(vencida)).toContain('error')
    expect(sev({ ...vencida, is_active: undefined })).toContain('error')
  })

  it('degrada TODAS las reglas de error, no solo la del plazo', () => {
    const examenPasado = { estado_proceso: 'pendiente_examen', exam_date: '2026-05-17' }
    expect(sev({ ...examenPasado, is_active: true })).toContain('error')
    expect(sev({ ...examenPasado, is_active: false })).not.toContain('error')
    expect(reglas({ ...examenPasado, is_active: false })).toContain('pendiente_examen_pasado')
  })

  it('los warn de una inactiva siguen siendo warn (no se inventan severidades)', () => {
    const s = sev({ estado_proceso: 'inscripcion_abierta', is_active: false })
    expect(s.every((x) => x === 'warn')).toBe(true)
  })
})
