const { numerosCitados, esLeyReglamento } = require('../../scripts/auditar-batch-input')

/**
 * Extractor de las remisiones que hacen las EXPLICACIONES, para adjuntarle al auditor
 * ciego los artículos citados (Paso 7 del manual `generar-preguntas-con-ia.md`).
 *
 * Los tres casos que fijan estos tests salieron de las auditorías ciegas del 26/07/2026,
 * y los tres compartían el mismo daño: **adjuntar el artículo EQUIVOCADO es peor que no
 * adjuntar ninguno**, porque el auditor razona sobre un texto que no es el citado y
 * devuelve un ISSUE inventado (o, peor, da por buena una glosa que no lo es).
 */
describe('numerosCitados', () => {
  it('conserva el SUFIJO de reforma: "75 bis.1" no es el artículo 75', () => {
    // Caso raíz: la glosa citaba el art. 75 bis.1 de la LBRL (que sí contempla la
    // dedicación parcial en municipios de menos de 1.000 habitantes) y se adjuntó el
    // art. 75, otro precepto. El auditor, sin el texto citado, razonó de memoria y
    // devolvió un fallo que no existía: la glosa era exacta.
    expect(numerosCitados('la parcial la contempla el artículo 75 bis.1 de esta ley')).toEqual(['75 bis'])
    expect(numerosCitados('el artículo 127 octies del mismo texto')).toEqual(['127 octies'])
    expect(numerosCitados('el art. 367 quáter')).toEqual(['367 quáter'])
  })

  it('no parte "octies" por su "e": el separador exige frontera de palabra', () => {
    // La lista se trocea por «,», «y» e «e». Sin frontera de palabra, "127 octies"
    // salía como ["127 octi", "s"] y no resolvía nada.
    expect(numerosCitados('los arts. 127 octies y 128 nonies')).toEqual(['127 octies', '128 nonies'])
  })

  it('descarta la cita a OTRA norma aunque no la nombre ("de la citada Ley Orgánica")', () => {
    // Caso raíz: "en aplicación del artículo 31 de la citada Ley Orgánica" (LOPDGDD)
    // se resolvía contra la ley de la pregunta y adjuntaba el art. 31 de la Ley 19/2013
    // —régimen sancionador de altos cargos—, un artículo HOMÓNIMO POR NÚMERO de otra
    // materia. Lo cazaron las DOS auditorías ciegas del mismo lote.
    expect(numerosCitados('en aplicación del artículo 31 de la citada Ley Orgánica')).toEqual([])
    expect(numerosCitados('los arts. 16 y 17 de la Ley 10/2010')).toEqual([])
    expect(numerosCitados('el artículo 4 de la mencionada Ley')).toEqual([])
    expect(numerosCitados('el artículo 9 del referido Real Decreto')).toEqual([])
    // 'Código Civil' faltaba en la lista de normas: una glosa que cite 'los artículos 235 y
    // 236 del Código Civil' habría adjuntado los arts. 235/236 de la ley de la pregunta.
    expect(numerosCitados('conforme a los artículos 235 y 236 del Código Civil')).toEqual([])
  })

  it('sigue resolviendo las remisiones al MISMO cuerpo legal', () => {
    expect(numerosCitados('conforme al artículo 21.4 y el art. 120')).toEqual(['21', '120'])
    expect(numerosCitados('los arts. 16, 17 y 18 de esta ley')).toEqual(['16', '17', '18'])
    expect(numerosCitados('según el artículo 80 de esta Ley')).toEqual(['80'])
  })

  // 31/07/2026, lote `gen_rd203_t331_2026-07-31`: el batch iba de un REGLAMENTO (el aprobado por
  // el RD 203/2021), así que "del Reglamento" es el mismo cuerpo, no otro. Se descartaba, y el
  // auditor se quedaba sin el art. 41 que una viñeta invocaba. Los arts. 42 y 47 se salvaron por
  // casualidad: otras viñetas los nombraban sin el "del Reglamento".
  it('"del Reglamento" a secas es el MISMO cuerpo si la ley del lote ES un reglamento', () => {
    const R = { leyEsReglamento: true }
    expect(numerosCitados('lo invoca el artículo 41 del Reglamento cuando la relación…', R)).toEqual(['41'])
    expect(numerosCitados('el artículo 42.1 del Reglamento, para las notificaciones', R)).toEqual(['42'])
    expect(numerosCitados('conforme al artículo 55 del citado Reglamento', R)).toEqual(['55'])
  })

  // …y esta es la otra mitad, que costó un falso positivo el MISMO día. El lote
  // `gen_lopdgdd_t115_2026-07-31` va sobre la LO 3/2018 y sus explicaciones citan "el artículo 60
  // del Reglamento" refiriéndose al Reglamento (UE) 2016/679. Con la excepción aplicada a ciegas
  // se adjuntaron los arts. 56, 60 y 65 de la LEY ORGÁNICA ("Acción exterior", "Admisión a
  // trámite de las reclamaciones"): el artículo HOMÓNIMO de otra materia, que es peor que nada.
  it('…pero NO si la ley del lote es una ley (ahí "del Reglamento" es el europeo)', () => {
    expect(numerosCitados('el artículo 60 del Reglamento establece el procedimiento')).toEqual([])
    expect(numerosCitados('el artículo 65 del Reglamento prevé la decisión vinculante')).toEqual([])
    // el defecto se detecta por el NOMBRE de la ley, no se adivina
    expect(esLeyReglamento('Real Decreto 203/2021, de 30 de marzo, por el que se aprueba el Reglamento de actuación y funcionamiento del sector público por medios electrónicos')).toBe(true)
    expect(esLeyReglamento('Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales')).toBe(false)
    expect(esLeyReglamento('')).toBe(false)
  })

  it('…y un Reglamento IDENTIFICADO nunca es el mismo cuerpo, ni siendo reglamento la ley', () => {
    const R = { leyEsReglamento: true }
    expect(numerosCitados('el artículo 5 del Reglamento (UE) 2016/679', R)).toEqual([])
    expect(numerosCitados('el artículo 5 del Reglamento General de Protección de Datos', R)).toEqual([])
    expect(numerosCitados('el artículo 3 del Reglamento de ejecución 2015/2447', R)).toEqual([])
    expect(numerosCitados('el artículo 3 del Reglamento n.º 1/2005', R)).toEqual([])
    expect(numerosCitados('el artículo 9 del Reglamento delegado', R)).toEqual([])
  })

  it('el apartado se descarta y el sufijo NO', () => {
    expect(numerosCitados('el artículo 102.3')).toEqual(['102'])
    expect(numerosCitados('el artículo 102 bis.3')).toEqual(['102 bis'])
  })
})
