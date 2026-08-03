/**
 * Los cuatro modos en que una cita puede ser LITERAL y estar mal (T-409).
 *
 * Todos los casos salen de citas reales escritas durante la reparación de 256 preguntas: los tres
 * primeros modos se descubrieron uno a uno —cada vez creyendo que ya estaban todos— y el cuarto es
 * el que enseña por qué: el gate comprobaba que la cita ACABARA en punto, y el punto lo ponía quien
 * escribía la cita.
 *
 * Lo que defiende: que cada modo siga cazándose por separado. Son extremos distintos del mismo
 * defecto y arreglar uno no cubre los otros.
 */

const { diagnosticaRecorte } = require('../../lib/health/citaRecortada.cjs')

const modos = (cita: string, articulo = '') =>
  diagnosticaRecorte(cita, articulo).map((a: { modo: string }) => a.modo)

describe('modo 1 — cortada por el FINAL', () => {
  it('avisa cuando la cita no cierra la frase', () => {
    expect(modos('se requerirá al interesado para que, en un plazo de diez días')).toContain('no_cierra')
  })

  it('una cita que cierra bien no avisa por este motivo', () => {
    const art = 'La justicia será gratuita cuando así lo disponga la ley.'
    expect(modos('La justicia será gratuita cuando así lo disponga la ley.', art)).not.toContain('no_cierra')
  })
})

describe('modo 2 — cortada por el PRINCIPIO', () => {
  it('avisa cuando arranca a mitad de oración y pierde el sujeto', () => {
    // Real: la cita empezaba aquí y dejaba fuera «Los trabajadores tendrán derecho a efectuar…».
    expect(modos('propuestas al empresario, así como a los órganos de participación.')).toContain(
      'arranca_en_minuscula',
    )
  })

  it('no confunde una cita que empieza en mayúscula', () => {
    expect(modos('Los trabajadores tendrán derecho a efectuar propuestas al empresario.')).not.toContain(
      'arranca_en_minuscula',
    )
  })
})

describe('modo 3 — se queda EN LA PUERTA de la enumeración', () => {
  const articulo =
    'Cuando la utilización de un equipo de trabajo pueda presentar un riesgo específico para la ' +
    'seguridad y la salud de los trabajadores, el empresario adoptará las medidas necesarias con el ' +
    'fin de que: a) La utilización del equipo de trabajo quede reservada a los encargados de dicha ' +
    'utilización. b) Los trabajos de reparación, transformación, mantenimiento o conservación sean ' +
    'realizados por los trabajadores específicamente capacitados para ello.'

  it('avisa: la cita acaba en dos puntos y la enumeración que prueba la clave queda fuera', () => {
    const cita =
      'Cuando la utilización de un equipo de trabajo pueda presentar un riesgo específico para la ' +
      'seguridad y la salud de los trabajadores, el empresario adoptará las medidas necesarias con el fin de que:'
    expect(modos(cita, articulo)).toContain('enumeracion_fuera')
  })

  it('NO avisa si detrás de los dos puntos no hay enumeración (el encabezado ya contiene la respuesta)', () => {
    // Caso real que se deja pasar a propósito: ahí la respuesta —«la ley electoral»— está en el
    // propio encabezado, así que la cita sostiene la clave sin la lista.
    const art = 'La ley electoral determinará las causas de inelegibilidad e incompatibilidad de los Diputados y Senadores.'
    expect(modos('La ley electoral determinará las causas de inelegibilidad e incompatibilidad de los Diputados y Senadores.', art))
      .not.toContain('enumeracion_fuera')
  })
})

describe('modo 4 — el punto final es AÑADIDO (el gate no puede fiarse de la forma)', () => {
  const articulo =
    'Los documentos presentados de manera presencial ante las Administraciones Públicas, deberán ser ' +
    'digitalizados por la oficina de asistencia en materia de registros, devolviéndose los originales ' +
    'al interesado, sin perjuicio de aquellos supuestos en que la norma determine la custodia por la ' +
    'Administración de los documentos presentados.'

  it('caza la cita cerrada con un punto donde el artículo tenía una coma y seguía', () => {
    const cita =
      'Los documentos presentados de manera presencial ante las Administraciones Públicas, deberán ser ' +
      'digitalizados por la oficina de asistencia en materia de registros, devolviéndose los originales al interesado.'
    const r = modos(cita, articulo)
    expect(r).toContain('cierre_anadido')
    // Y no avisa por el modo 1: formalmente SÍ cierra. Ese es justo el punto ciego que cubre.
    expect(r).not.toContain('no_cierra')
  })

  it('no avisa cuando el punto existe de verdad en el artículo', () => {
    const cita =
      'Los documentos presentados de manera presencial ante las Administraciones Públicas, deberán ser ' +
      'digitalizados por la oficina de asistencia en materia de registros, devolviéndose los originales ' +
      'al interesado, sin perjuicio de aquellos supuestos en que la norma determine la custodia por la ' +
      'Administración de los documentos presentados.'
    expect(modos(cita, articulo)).not.toContain('cierre_anadido')
  })

  it('no opina sobre fragmentos demasiado cortos para localizarlos con seguridad', () => {
    expect(modos('en todo caso.', 'en todo caso, se exigirá lo siguiente')).not.toContain('cierre_anadido')
  })
})

describe('robustez', () => {
  it('una cita vacía o nula no produce avisos', () => {
    expect(diagnosticaRecorte('', 'artículo')).toEqual([])
    expect(diagnosticaRecorte(null as never, 'artículo')).toEqual([])
  })

  it('sin artículo solo puede juzgar la forma, no la fuente', () => {
    const r = modos('se requerirá al interesado para que, en un plazo de diez días')
    expect(r).toContain('no_cierra')
    expect(r).not.toContain('cierre_anadido')
  })
})
