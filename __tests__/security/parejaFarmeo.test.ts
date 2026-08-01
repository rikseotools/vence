/**
 * @jest-environment node
 */
// Unitarios del detector de «pareja clavada en su tope» (T-372). Importa el núcleo REAL que usan
// el sweep del backend (vía su espejo, con test de paridad) y el gemelo CLI.
//
// Lo que se fija aquí no es la implementación: son las DECISIONES DE CALIBRACIÓN, que son lo
// único que hace a este detector útil o ruidoso. Cada una tiene detrás un dato de producción.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarDia, clasificarEquipo, estaClavada, gravedad, TOPE_FREE } =
  require('@/lib/security/parejaFarmeo')

const dia = (...preguntas: number[]) => preguntas.map((q, i) => ({ userId: `u${i}`, preguntas: q }))
const equipo = (dias: number[][]) => dias.map((c, i) => ({ fecha: `d${i}`, cuentas: dia(...c) }))
const rep = (n: number, d: number[]) => Array.from({ length: n }, () => d)

describe('estaClavada — dónde está el tope', () => {
  it('25 es el tope del free y se ve como un muro en los datos', () => {
    // Medido: 3.624 usuario-días en 25 frente a 172 en 24.
    expect(TOPE_FREE).toBe(25)
    expect(estaClavada(25)).toBe(true)
  })

  it('el 24 TAMBIÉN cuenta: agotar el cupo no siempre cae exacto', () => {
    expect(estaClavada(24)).toBe(true)
  })

  it('el 23 no', () => {
    expect(estaClavada(23)).toBe(false)
  })
})

describe('clasificarDia — «todas al tope» exige que sean DOS o más', () => {
  it('una sola cuenta a 25 NO es un equipo: es alguien apurando su free', () => {
    expect(clasificarDia(dia(25)).todasClavadas).toBe(false)
  })

  it('dos al tope, sí', () => {
    expect(clasificarDia(dia(25, 25)).todasClavadas).toBe(true)
  })

  it('si una reparte, no', () => {
    // La familia: hoy 25 y 6. El farmer no hace eso.
    expect(clasificarDia(dia(25, 6)).todasClavadas).toBe(false)
  })

  it('un trío entero al tope también cuenta', () => {
    expect(clasificarDia(dia(25, 25, 25)).todasClavadas).toBe(true)
  })

  it('las cuentas a CERO no cuentan como activas (si no, cualquier día parecería repartido)', () => {
    const r = clasificarDia(dia(25, 25, 0))
    expect(r.activas).toBe(2)
    expect(r.todasClavadas).toBe(true)
  })
})

describe('clasificarEquipo — repetición Y proporción, porque ninguna basta sola', () => {
  it('los TRES equipos confirmados a mano el 31/07 salen como farmeo', () => {
    // Es la validación que decide si el detector vale: reproduce el veredicto humano.
    expect(clasificarEquipo(equipo([...rep(18, [25, 25]), ...rep(6, [25, 2])])).veredicto).toBe('farmeo') // 2bbb2177, 75%
    expect(clasificarEquipo(equipo([...rep(9, [25, 25]), ...rep(3, [12, 0])])).veredicto).toBe('farmeo')  // d60ca3e4, 75%
    expect(clasificarEquipo(equipo([...rep(3, [25, 25]), ...rep(2, [8, 1])])).veredicto).toBe('farmeo')   // 002999b0, 60%
  })

  it('«1 día clavado de 16» es una familia con un día intenso, NO farmeo', () => {
    // Sin el mínimo de días, este equipo abriría señal y el inbox se llenaría de gente normal.
    const r = clasificarEquipo(equipo([...rep(1, [25, 25]), ...rep(15, [14, 6])]))
    expect(r.veredicto).toBe('normal')
  })

  it('«3 días clavados pero solo el 38% de sus días» va a REVISAR, no a señal', () => {
    // La proporción es lo que separa `18 de 20` de `3 de 8`. Ambos tienen «días clavados».
    const r = clasificarEquipo(equipo([...rep(3, [25, 25]), ...rep(5, [10, 2])]))
    expect(r.veredicto).toBe('revisar')
    expect(r.motivo).toMatch(/38%/)
  })

  it('una familia que reparte SIEMPRE nunca dispara, por muchos días que lleve', () => {
    expect(clasificarEquipo(equipo(rep(60, [25, 6]))).veredicto).toBe('normal')
  })

  it('la proporción se mide sobre días ACTIVOS, no sobre la ventana', () => {
    // Quien solo usa la app 4 días al mes saldría siempre bajo si el denominador fueran 30.
    const r = clasificarEquipo(equipo(rep(4, [25, 25])))
    expect(r.diasActivos).toBe(4)
    expect(r.proporcion).toBe(1)
    expect(r.veredicto).toBe('farmeo')
  })

  it('las fronteras: 3 días entra, 2 no', () => {
    expect(clasificarEquipo(equipo(rep(3, [25, 25]))).veredicto).toBe('farmeo')
    expect(clasificarEquipo(equipo(rep(2, [25, 25]))).veredicto).toBe('normal')
  })

  it('sin días no inventa nada', () => {
    expect(clasificarEquipo([]).veredicto).toBe('normal')
    expect(clasificarEquipo(null).diasActivos).toBe(0)
  })
})

describe('gravedad', () => {
  it('sube a `high` cuando la rutina es larga', () => {
    expect(gravedad(clasificarEquipo(equipo(rep(18, [25, 25]))))).toBe('high')
  })
  it('lo justo entra como `medium`', () => {
    expect(gravedad(clasificarEquipo(equipo(rep(3, [25, 25]))))).toBe('medium')
  })
  it('lo que no es farmeo nunca es `high`', () => {
    expect(gravedad(clasificarEquipo(equipo(rep(1, [25, 25]))))).toBe('medium')
  })
})
