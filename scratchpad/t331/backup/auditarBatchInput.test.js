const { numerosCitados } = require('../../scripts/auditar-batch-input')

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
  it('"del Reglamento" a secas es el MISMO cuerpo, no otra norma', () => {
    expect(numerosCitados('lo invoca el artículo 41 del Reglamento cuando la relación…')).toEqual(['41'])
    expect(numerosCitados('el artículo 42.1 del Reglamento, para las notificaciones')).toEqual(['42'])
    expect(numerosCitados('conforme al artículo 55 del citado Reglamento')).toEqual(['55'])
  })

  it('…pero un Reglamento IDENTIFICADO sigue siendo otra norma', () => {
    expect(numerosCitados('el artículo 5 del Reglamento (UE) 2016/679')).toEqual([])
    expect(numerosCitados('el artículo 5 del Reglamento General de Protección de Datos')).toEqual([])
    expect(numerosCitados('el artículo 3 del Reglamento de ejecución 2015/2447')).toEqual([])
    expect(numerosCitados('el artículo 3 del Reglamento n.º 1/2005')).toEqual([])
    expect(numerosCitados('el artículo 9 del Reglamento delegado')).toEqual([])
  })

  it('el apartado se descarta y el sufijo NO', () => {
    expect(numerosCitados('el artículo 102.3')).toEqual(['102'])
    expect(numerosCitados('el artículo 102 bis.3')).toEqual(['102 bis'])
  })
})
