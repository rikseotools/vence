// __tests__/lib/ci/schemaDumpFreshness.test.js
// [T-644] Núcleo puro — fechas fijas, sin filesystem ni red. El guardarraíl real que lee el
// fichero del repo vive en __tests__/guardrails/schemaDumpFresco.guardrail.test.ts.
const {
  UMBRAL_DIAS_DEFECTO,
  extraerFechaDump,
  diasDeAntiguedad,
  veredictoFrescura,
} = require('../../../lib/ci/schemaDumpFreshness')

describe('extraerFechaDump', () => {
  it('lee la fecha del marcador en la primera línea', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-01T00:00:00.000Z\nCREATE TABLE x();'
    const d = extraerFechaDump(sql)
    expect(d).toBeInstanceOf(Date)
    expect(d.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('encuentra el marcador aunque no sea la primera línea', () => {
    const sql = '-- pg_dump header\n-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-01T00:00:00.000Z\nCREATE TABLE x();'
    expect(extraerFechaDump(sql)).toEqual(new Date('2026-08-01T00:00:00.000Z'))
  })

  it('null si no hay marcador', () => {
    expect(extraerFechaDump('CREATE TABLE x();')).toBeNull()
  })

  it('null si el marcador trae una fecha inválida', () => {
    expect(extraerFechaDump('-- VENCE_SCHEMA_DUMP_GENERADO_EN: no-es-una-fecha\n')).toBeNull()
  })

  it('null con entrada vacía o no-string', () => {
    expect(extraerFechaDump('')).toBeNull()
    expect(extraerFechaDump(null)).toBeNull()
    expect(extraerFechaDump(undefined)).toBeNull()
  })
})

describe('diasDeAntiguedad', () => {
  it('calcula días completos entre dos fechas', () => {
    expect(diasDeAntiguedad(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-08T00:00:00Z'))).toBe(7)
  })

  it('fracciones de día no se redondean', () => {
    expect(diasDeAntiguedad(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-01T12:00:00Z'))).toBeCloseTo(0.5)
  })

  it('negativo si el dump está fechado en el futuro (reloj desincronizado)', () => {
    expect(diasDeAntiguedad(new Date('2026-08-10T00:00:00Z'), new Date('2026-08-08T00:00:00Z'))).toBeLessThan(0)
  })
})

describe('veredictoFrescura — el veredicto que usa el guardarraíl', () => {
  const AHORA = new Date('2026-08-08T00:00:00Z')

  it('fresco: dentro del umbral', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-05T00:00:00.000Z\n'
    const v = veredictoFrescura(sql, AHORA)
    expect(v.fresco).toBe(true)
    expect(v.dias).toBe(3)
  })

  it('justo en el umbral (7 días) sigue fresco — el corte es ESTRICTAMENTE mayor', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-01T00:00:00.000Z\n'
    const v = veredictoFrescura(sql, AHORA)
    expect(v.dias).toBe(7)
    expect(v.fresco).toBe(true)
  })

  it('viejo: por encima del umbral', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-07-01T00:00:00.000Z\n'
    const v = veredictoFrescura(sql, AHORA)
    expect(v.fresco).toBe(false)
    expect(v.motivo).toMatch(/38\.0 días/)
  })

  it('sin marcador: no fresco, motivo explícito (no es lo mismo que "viejo")', () => {
    const v = veredictoFrescura('CREATE TABLE x();', AHORA)
    expect(v.fresco).toBe(false)
    expect(v.dias).toBeNull()
    expect(v.motivo).toMatch(/sin marcador/)
  })

  it('reloj futuro no cuenta como viejo', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-09T00:00:00.000Z\n'
    expect(veredictoFrescura(sql, AHORA).fresco).toBe(true)
  })

  it('el umbral es ajustable (Manuel: "empieza por 7 y ajusta con lo que veas")', () => {
    const sql = '-- VENCE_SCHEMA_DUMP_GENERADO_EN: 2026-08-05T00:00:00.000Z\n' // 3 días
    expect(veredictoFrescura(sql, AHORA, 2).fresco).toBe(false)
    expect(veredictoFrescura(sql, AHORA, 3).fresco).toBe(true)
    expect(UMBRAL_DIAS_DEFECTO).toBe(7)
  })
})
