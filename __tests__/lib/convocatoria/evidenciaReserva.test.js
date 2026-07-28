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
    const corpus = 'Se convocan 100 plazas. Del total de las plazas convocadas se reservarán 8 para personas con discapacidad. ' +
      'Anexo: Turno libre Discapacidad Total 100 8 108.'
    const props = proponerRelacion(corpus, { plazasLibres: 100, plazasDiscapacidad: 8 })
    expect(props.length).toBeGreaterThan(1)
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
