import {
  diffDias,
  plazasTotal,
  añoOep,
  calcularConvocatoria,
  celdaConvocatoria,
  resumenHistorico,
  type ConvocatoriaHistorica,
} from '@/lib/convocatoria/historico'

const base: ConvocatoriaHistorica = {
  año: 2023,             // año de la CONVOCATORIA
  añoOep: 2022,          // año de la OEP (MAX de las enlazadas por convocatoria_oep)
  oepDecretos: ['RD 407/2022', 'RD 636/2021'],
  oepFecha: '2022-05-30',
  isCurrent: false,
  estadoProceso: 'examen_realizado',
  convocatoriaFecha: '2023-01-15',
  boeReference: 'BOE-A-2023-1000',
  programaUrl: null,
  examDate: '2023-11-19',
  plazasLibres: 1000,
  plazasPromocionInterna: 200,
  plazasDiscapacidad: 50,
  inscritos: 90000,
  presentados: 45000,
}

describe('diffDias', () => {
  it('cuenta días naturales entre dos fechas ISO', () => {
    expect(diffDias('2023-01-01', '2023-01-31')).toBe(30)
  })
  it('devuelve null si falta alguna fecha', () => {
    expect(diffDias(null, '2023-01-31')).toBeNull()
    expect(diffDias('2023-01-01', null)).toBeNull()
  })
  it('devuelve null con fecha inválida', () => {
    expect(diffDias('no-fecha', '2023-01-31')).toBeNull()
  })
})

describe('plazasTotal', () => {
  it('suma los turnos presentes', () => {
    expect(plazasTotal({ plazasLibres: 1000, plazasPromocionInterna: 200, plazasDiscapacidad: 50 })).toBe(1250)
  })
  it('ignora los turnos null', () => {
    expect(plazasTotal({ plazasLibres: 1000, plazasPromocionInterna: null, plazasDiscapacidad: null })).toBe(1000)
  })
  it('devuelve null si todos son null (nunca 0 fantasma)', () => {
    expect(plazasTotal({ plazasLibres: null, plazasPromocionInterna: null, plazasDiscapacidad: null })).toBeNull()
  })
})

describe('añoOep — año de la fila desde el enlace estructurado (T-108)', () => {
  it('usa el añoOep de la entidad (no deriva de ninguna fecha)', () => {
    expect(añoOep({ año: 2024, añoOep: 2022 })).toBe(2022)
  })
  it('fallback al año de convocatoria solo si no hay OEP enlazada', () => {
    expect(añoOep({ año: 2024, añoOep: null })).toBe(2024)
  })
})

describe('calcularConvocatoria', () => {
  it('deriva plazos, ratios y añoMostrado', () => {
    const c = calcularConvocatoria(base)
    expect(c.añoMostrado).toBe(2022) // año de OEP, no el 2023 de la convocatoria
    expect(c.plazasTotal).toBe(1250)
    expect(c.diasConvocatoriaAExamen).toBe(diffDias('2023-01-15', '2023-11-19'))
    expect(c.diasOepAExamen).toBe(diffDias('2022-05-30', '2023-11-19'))
    // ratio sobre plazas de ACCESO LIBRE (1000), no sobre el total con promoción interna
    expect(c.inscritosPorPlaza).toBeCloseTo(90000 / 1000)
    expect(c.presentadosPorPlaza).toBeCloseTo(45000 / 1000)
    expect(c.tasaPresentacion).toBeCloseTo(0.5)
  })
  it('null-safe: sin fechas ni participación no inventa ratios', () => {
    const c = calcularConvocatoria({
      ...base,
      oepFecha: null,
      convocatoriaFecha: null,
      examDate: null,
      inscritos: null,
      presentados: null,
    })
    expect(c.diasConvocatoriaAExamen).toBeNull()
    expect(c.diasOepAExamen).toBeNull()
    expect(c.inscritosPorPlaza).toBeNull()
    expect(c.presentadosPorPlaza).toBeNull()
    expect(c.tasaPresentacion).toBeNull()
  })
  it('no divide por cero si el total de plazas es 0', () => {
    const c = calcularConvocatoria({
      ...base,
      plazasLibres: 0,
      plazasPromocionInterna: null,
      plazasDiscapacidad: null,
      inscritos: 100,
    })
    expect(c.plazasTotal).toBe(0)
    expect(c.inscritosPorPlaza).toBeNull()
  })
})

describe('celdaConvocatoria — GUARDARRAÍL anti-fecha-errónea', () => {
  it('muestra la fecha real si convocatoria_fecha existe', () => {
    const r = celdaConvocatoria({ convocatoriaFecha: '2023-01-20' })
    expect(r).toEqual({ pendiente: false, fecha: '2023-01-20' })
  })
  it('sin convocatoria_fecha => PENDIENTE, nunca una fecha', () => {
    const r = celdaConvocatoria({ convocatoriaFecha: null })
    expect(r.pendiente).toBe(true)
    expect(r.fecha).toBeNull()
  })
  it('NUNCA infiere la fecha de otra fuente (OEP, BOE, examen) — la firma solo acepta convocatoriaFecha', () => {
    // El guardarraíl es estructural: celdaConvocatoria solo mira convocatoriaFecha.
    // Aunque el objeto traiga oepFecha/boeReference/examDate poblados, si convocatoriaFecha
    // es null el resultado es PENDIENTE. Evita pintar la fecha de la OEP como si fuera la de
    // la convocatoria.
    const conFechasVecinas = {
      convocatoriaFecha: null,
      oepFecha: '2026-05-06',
      examDate: '2026-11-01',
      boeReference: 'BOE-A-2026-9946',
    }
    const r = celdaConvocatoria(conFechasVecinas)
    expect(r.pendiente).toBe(true)
    expect(r.fecha).toBeNull()
  })
  it('pendiente y fecha son mutuamente excluyentes en ambos casos', () => {
    for (const cf of [null, '2020-01-01']) {
      const r = celdaConvocatoria({ convocatoriaFecha: cf })
      expect(r.pendiente).toBe(r.fecha === null)
    }
  })
})

describe('resumenHistorico', () => {
  it('ordena por año de OEP (del enlace estructurado) descendente', () => {
    const r = resumenHistorico([
      { ...base, año: 999, añoOep: 2019 },
      { ...base, año: 999, añoOep: 2023 },
      { ...base, año: 999, añoOep: 2021 },
    ])
    // el orden y la etiqueta vienen del AÑO DE LA OEP, no del campo `año` (aquí basura=999)
    expect(r.convocatorias.map((c) => c.añoMostrado)).toEqual([2023, 2021, 2019])
    expect(r.totalAños).toBe(3)
  })
  it('promedia solo los años con dato (ignora nulls)', () => {
    const r = resumenHistorico([
      { ...base, año: 2023, convocatoriaFecha: '2023-01-01', examDate: '2023-11-19' },
      { ...base, año: 2021, convocatoriaFecha: null, examDate: null }, // sin plazo → se ignora
    ])
    const soloConDato = r.convocatorias.find((c) => c.año === 2023)!.diasConvocatoriaAExamen
    expect(r.mediaDiasConvocatoriaAExamen).toBe(soloConDato)
  })
  it('media null si ningún año tiene el dato', () => {
    const r = resumenHistorico([
      { ...base, año: 2023, inscritos: null },
      { ...base, año: 2021, inscritos: null },
    ])
    expect(r.mediaInscritosPorPlaza).toBeNull()
  })
})
