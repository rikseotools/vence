/**
 * @jest-environment node
 */
// Lector de evidencia sobre el cupo de discapacidad — [T-218].
//
// Los cuatro casos son LITERALES de los boletines de las cuatro convocatorias que se declararon a
// mano el 28/07: son la razón de que este módulo exista y la prueba de que reconoce lo que hay ahí
// fuera, no una forma inventada. Los contraejemplos importan igual: proponer de más en un dato que
// decide si alguien se presenta a una oposición es peor que no proponer.
const { proponerRelacion, propuestaUnanime } = require('@/lib/convocatoria/evidenciaReserva.cjs')

describe('proponerRelacion — las cuatro formas reales', () => {
  it('UNED (BOE): prosa «del total de las plazas convocadas se reservarán 6» → DENTRO', () => {
    const corpus = 'Primera. Normas generales. 1.1 Se convocan pruebas selectivas para cubrir 54 plazas de la Escala de Auxiliares Administrativos de la UNED, subgrupo C2, por el sistema general de acceso libre. Del total de las plazas convocadas se reservarán 6 para ser cubiertas por quienes tengan la condición de persona con discapacidad.'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 54, plazasDiscapacidad: 6 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(true)
  })

  it('CLM (DOCM): fila «305 9 13 327» con nuestro 327 al final → DENTRO', () => {
    const corpus = 'Cupo general Reserva personas con discapacidad Total plazas C2 Cuerpo Auxiliar 305 9 13 327 Total personal funcionario'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 327, plazasDiscapacidad: 22 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(true)
    expect(p.evidencias[0].via).toMatch(/TOTAL de la fila/)
  })

  it('SERMAS (BOCM): prosa «se dividen en dos cupos» → APARTE', () => {
    const corpus = 'Las plazas convocadas se proveerán por el sistema de turno libre, y se dividen en dos cupos: — Plazas del cupo general: 1.747. — Plazas del cupo de reserva para personas con discapacidad: 131.'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 1747, plazasDiscapacidad: 131 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(false)
  })

  it('GVA (DOGV): fila «89 7 23 3 122» con nuestro 89 al principio → APARTE', () => {
    const corpus = 'Turno libre Discapacidad Discapacidad intelectual Enfermedad mental C1-01. Cos administratiu. 89 7 23 3 122 C1-01. Cuerpo administrativo.'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 89, plazasDiscapacidad: 33 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(false)
    expect(p.evidencias[0].via).toMatch(/cierra con la suma/)
  })
})

describe('proponerRelacion — cuándo NO debe proponer', () => {
  it('una mención genérica a reservas legales, lejos de nuestras cifras, no prueba nada', () => {
    // Esto sale en TODAS las convocatorias (remisión al art. 59 del EBEP) y no dice nada de ESTA.
    const corpus = 'De conformidad con lo previsto en el artículo 59 del Real Decreto Legislativo 5/2015, del total de las plazas se reservará un cupo para personas con discapacidad, en los términos legalmente establecidos. ' + 'Relleno. '.repeat(80) + 'Se convocan 200 plazas.'
    expect(proponerRelacion(corpus, { plazasLibres: 200, plazasDiscapacidad: 14 })).toHaveLength(0)
  })

  it('una fila de números que no cuadra con nuestras cifras no se fuerza', () => {
    const corpus = 'Cuerpo Auxiliar 305 9 13 327 Total'
    expect(proponerRelacion(corpus, { plazasLibres: 100, plazasDiscapacidad: 7 })).toHaveLength(0)
  })

  it('si el corpus da evidencia de los DOS lados, no se elige por mayoría: se manda a leer', () => {
    // La prosa dice «del total de las 100 se reservan 8» (dentro) y, MUY lejos, un anexo da la fila
    // «100 8 108» (aparte). Separados a propósito: si cayeran en la misma ventana, la prosa se
    // callaría sola por ambigua y no habría contradicción que probar.
    const corpus = 'Se convocan 100 plazas. Del total de las plazas convocadas se reservarán 8 para personas con discapacidad. ' +
      'Relleno intermedio sin cifras. '.repeat(30) +
      'Anexo: Turno libre Discapacidad Total 100 8 108.'
    const props = proponerRelacion(corpus, { plazasLibres: 100, plazasDiscapacidad: 8 })
    expect(props.length).toBeGreaterThan(1)
    expect(new Set(props.map((p) => p.incluidas)).size).toBe(2)
    expect(propuestaUnanime(props)).toBeNull()
  })

  it('sin cupo en BD no hay nada que proponer', () => {
    expect(proponerRelacion('lo que sea', { plazasLibres: 50, plazasDiscapacidad: 0 })).toHaveLength(0)
  })
})

// El fallo que tuvo la PRIMERA versión, en producción y a la primera: de 3 propuestas «limpias», las
// 3 eran coincidencia aritmética entre fechas y códigos. Con cifras pequeñas es facilísimo.
describe('proponerRelacion — no confundir una casualidad con una tabla', () => {
  it('un índice de procesos lleno de fechas no es evidencia, aunque los números cuadren', () => {
    const corpus = '20 de julio de 2026 29- PROCESO SELECTIVO DE TÉCNICO/A MEDIO/A DE GESTIÓN - 2 PLAZAS - P. FUNCIONARIO (O.E.P. 2025 Y 2026)-T. LIBRE Bases Específicas (B.O.P. de Huelva nº 138, de 20 de julio de 2026)'
    expect(proponerRelacion(corpus, { plazasLibres: 3, plazasDiscapacidad: 2 })).toHaveLength(0)
  })

  it('la MISMA aritmética sí cuenta cuando la fila habla de cupos', () => {
    const corpus = 'Categoría Cupo general Reserva personas con discapacidad Total plazas Ordenanza 1 2 3'
    const p = proponerRelacion(corpus, { plazasLibres: 3, plazasDiscapacidad: 2 })
    expect(p.length).toBeGreaterThan(0)
    expect(p[0].nums).toEqual([1, 2, 3])
  })
})

// La MISMA frase, dos veredictos opuestos, según qué total tengamos guardado. Lo destapó
// ujieres-cortes-generales (28/07): con la regla ingenua habría propuesto DENTRO y habría sido falso.
describe('proponerRelacion — «del total… se reservan N» depende de cuál sea ese total', () => {
  const UJIERES = 'han acordado la Oferta de Empleo Público de las Cortes Generales para el año 2026, que incluye una propuesta de convocatoria de cuarenta plazas para el Cuerpo de Ujieres de las Cortes Generales, para su provisión por el turno libre y de discapacidad. Del total de las plazas convocadas, de conformidad con lo dispuesto en el artículo 11.2 del Estatuto del Personal de las Cortes Generales, se reservan cuatro para ser cubiertas por personas con discapacidad.'

  it('si el total del boletín es NUESTRA cifra → dentro (UNED: 54 y 54)', () => {
    const corpus = 'Se convocan pruebas selectivas para cubrir 54 plazas de la Escala de Auxiliares Administrativos. Del total de las plazas convocadas se reservarán 6 para personas con discapacidad.'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 54, plazasDiscapacidad: 6 }))
    expect(p.incluidas).toBe(true)
  })

  it('si el total del boletín es nuestra cifra MÁS el cupo → aparte (Ujieres: guardamos 36, el BOE dice cuarenta)', () => {
    const p = propuestaUnanime(proponerRelacion(UJIERES, { plazasLibres: 36, plazasDiscapacidad: 4 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(false)
    expect(p.evidencias[0].via).toMatch(/MÁS el cupo/)
  })

  it('el total en LETRAS cuenta igual: los boletines lo escriben así más de lo que parece', () => {
    // «cuarenta» — si el lector solo mirara dígitos, esta convocatoria sería muda.
    expect(/\b40\b/.test(UJIERES)).toBe(false)
    expect(proponerRelacion(UJIERES, { plazasLibres: 36, plazasDiscapacidad: 4 }).length).toBeGreaterThan(0)
  })

  it('si la frase no trae ninguno de los dos totales, no se concluye', () => {
    const corpus = 'Del total de las plazas convocadas se reservará el cupo legalmente previsto para personas con discapacidad.'
    expect(proponerRelacion(corpus, { plazasLibres: 36, plazasDiscapacidad: 4 })).toHaveLength(0)
  })
})

// Cada boletín tiene su muletilla para decir lo mismo. Esta es del BOJA (subalterno-parlamento-
// andalucia, 28/07) y no se reconocía: la frase es tan concluyente como «del total».
describe('proponerRelacion — «de dichas plazas, se reserva una»', () => {
  it('BOJA: once plazas de las que se reserva una → dentro', () => {
    const corpus = 'Se convocan pruebas selectivas para cubrir once plazas del cuerpo de subalternos del Parlamento de Andalucía, por el sistema de oposición libre. De dichas plazas, se reserva una para ser cubierta entre personas con discapacidad de grado igual o superior al 33%.'
    const p = propuestaUnanime(proponerRelacion(corpus, { plazasLibres: 11, plazasDiscapacidad: 1 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(true)
  })
})

// Reparto explícito de un total entre turnos (BOP de Badajoz, 28/07). Como «del total…», no concluye
// sola: lo que decide es si guardamos el total o una de las partes.
describe('proponerRelacion — «de las 9, ocho por turno libre y una por discapacidad»', () => {
  const BADAJOZ = 'CONVOCATORIA PARA CUBRIR, MEDIANTE EL SISTEMA DE OPOSICIÓN LIBRE, 9 PLAZAS DE AUXILIAR ADMINISTRATIVO/A DEL AYUNTAMIENTO DE BADAJOZ, DE LAS CUALES 8 PLAZAS SE CUBRIRÁN POR EL TURNO DE ACCESO LIBRE Y 1 PLAZA ESTÁ DESTINADA A SER CUBIERTA POR EL TURNO DE DISCAPACIDAD.'

  it('guardamos la PARTE (8 de 9) → aparte', () => {
    const p = propuestaUnanime(proponerRelacion(BADAJOZ, { plazasLibres: 8, plazasDiscapacidad: 1 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(false)
  })

  it('si guardáramos el TOTAL, el mismo texto no concluye nada (no se inventa)', () => {
    const props = proponerRelacion(BADAJOZ, { plazasLibres: 9, plazasDiscapacidad: 1 })
    expect(props.filter((x) => x.via.includes('reparte'))).toHaveLength(0)
  })
})

// Ficha de bases sin prosa (Ayto. Sevilla, 28/07): no dice «del total», pero la decide la misma
// regla — si en la ventana está nuestra cifra y NO la suma, es que guardamos el total.
describe('proponerRelacion — ficha de bases «Plazas turno libre: N · Plazas reservadas: M»', () => {
  const SEVILLA = 'PLAZA: AUXILIAR ADMINISTRATIVO. Número: 46, de las cuáles 13 pertenece a la OPE 2021, 27 pertenecen a la OPE 2022 y 6 pertenecen a la OPE de 2023. Plazas turno libre: 46 Plazas reservadas a personas con discapacidad: 5, de las que 1 se reserva al cupo de personas con discapacidad intelectual.'

  it('el total y el turno libre son la misma cifra → dentro', () => {
    const p = propuestaUnanime(proponerRelacion(SEVILLA, { plazasLibres: 46, plazasDiscapacidad: 5 }))
    expect(p).not.toBeNull()
    expect(p.incluidas).toBe(true)
  })

  it('con otras cifras que no casan, no propone nada', () => {
    expect(proponerRelacion(SEVILLA, { plazasLibres: 200, plazasDiscapacidad: 9 })).toHaveLength(0)
  })
})
