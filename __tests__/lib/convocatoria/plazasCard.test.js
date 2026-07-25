const { sumaOtrosTurnos, combinacionesValidasPlazas } = require('@/lib/convocatoria/plazasCard.cjs')

describe('sumaOtrosTurnos', () => {
  it('suma las plazas de las reservas especiales', () => {
    expect(
      sumaOtrosTurnos([
        { turno: 'violencia_genero', plazas: 3 },
        { turno: 'terrorismo', plazas: 1 },
        { turno: 'trans', plazas: 1 },
      ])
    ).toBe(5)
  })
  it('0 con null, no-array o entradas sin plazas (el dato viene de jsonb sin garantía de forma)', () => {
    expect(sumaOtrosTurnos(null)).toBe(0)
    expect(sumaOtrosTurnos(undefined)).toBe(0)
    expect(sumaOtrosTurnos({ turno: 'x', plazas: 3 })).toBe(0)
    expect(sumaOtrosTurnos([{ turno: 'x' }, null])).toBe(0)
  })
})

describe('combinacionesValidasPlazas — FALSO POSITIVO real de administrativo-aragon (26/07)', () => {
  // BOA nº 247 de 23/12/2025, Anexo I, código 250102: «144 (3 reservadas a víctimas de
  // violencia de género, 1 reservada a víctimas de terrorismo y 1 reservada a personas
  // transexuales)». La tarjeta muestra 144 y es CORRECTA.
  const aragon = {
    libres: 139,
    discapacidad: null,
    promocionInterna: null,
    otrosTurnos: [
      { turno: 'violencia_genero', plazas: 3 },
      { turno: 'terrorismo', plazas: 1 },
      { turno: 'trans', plazas: 1 },
    ],
  }

  it('ACEPTA el total convocado 144 = 139 libres + 5 en reservas especiales', () => {
    expect(combinacionesValidasPlazas(aragon).has(144)).toBe(true)
  })
  it('acepta también el turno libre suelto (139)', () => {
    expect(combinacionesValidasPlazas(aragon).has(139)).toBe(true)
  })
  it('acepta una reserva especial citada sola (3 de violencia de género)', () => {
    expect(combinacionesValidasPlazas(aragon).has(3)).toBe(true)
  })
  it('SIGUE cazando un número stale que no sale de la convocatoria', () => {
    const v = combinacionesValidasPlazas(aragon)
    expect(v.has(150)).toBe(false)
    expect(v.has(140)).toBe(false)
  })
})

describe('combinacionesValidasPlazas — comportamiento general', () => {
  it('mantiene las combinaciones clásicas de los 3 turnos comunes', () => {
    const v = combinacionesValidasPlazas({ libres: 26, discapacidad: 2, promocionInterna: 10 })
    expect(v.has(26)).toBe(true)
    expect(v.has(2)).toBe(true)
    expect(v.has(10)).toBe(true)
    expect(v.has(28)).toBe(true) // libres + discapacidad
    expect(v.has(36)).toBe(true) // libres + PI
    expect(v.has(38)).toBe(true) // total
    expect(v.has(27)).toBe(false)
  })
  it('nunca admite 0 ni negativos', () => {
    const v = combinacionesValidasPlazas({ libres: 0, discapacidad: 0, promocionInterna: 0 })
    expect(v.size).toBe(0)
  })
  it('tolera una convocatoria vacía sin reventar', () => {
    expect(combinacionesValidasPlazas({}).size).toBe(0)
    expect(combinacionesValidasPlazas(null).size).toBe(0)
  })
})
