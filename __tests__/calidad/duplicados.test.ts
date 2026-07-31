// __tests__/calidad/duplicados.test.ts
//
// El criterio de «esta pregunta ya está en el banco». Lo que se fija aquí no es cosmético:
// cada caso viene de una medición del 31/07/2026 en la que el criterio equivocado habría
// borrado preguntas buenas o dejado pasar las repetidas. [T-408 · T-410]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dup = require('@/lib/calidad/duplicados.js')

describe('normalizar — qué diferencias NO son diferencias', () => {
  it('ignora puntuación, espacios y mayúsculas', () => {
    expect(dup.normalizar('¿Qué palabra sobra?')).toBe(dup.normalizar('que palabra   sobra'))
    // El caso real: las copias del banco solo se diferenciaban en el punto final.
    expect(dup.normalizar('Serio.')).toBe(dup.normalizar('Serio'))
  })

  it('ignora los acentos pero CONSERVA la ñ', () => {
    expect(dup.normalizar('Círculo')).toBe('circulo')
    // Si la ñ se fuera con los acentos, «año» y «ano» serían la misma palabra.
    expect(dup.normalizar('año')).toBe('año')
    expect(dup.normalizar('año')).not.toBe(dup.normalizar('ano'))
  })

  it('quita el HTML, que en este banco es basura de importación', () => {
    expect(dup.normalizar('Indique la palabra<br> sobrante')).toBe(
      dup.normalizar('Indique la palabra sobrante'))
  })

  it('trata null y undefined como cadena vacía en vez de romper', () => {
    expect(dup.normalizar(null)).toBe('')
    expect(dup.normalizar(undefined)).toBe('')
  })
})

describe('claveOpciones — las copias vienen BARAJADAS', () => {
  it('empareja dos copias con las mismas opciones en distinto orden', () => {
    const a = dup.claveOpciones(['Círculo', 'Cubo', 'Circunferencia', 'Triángulo'])
    const b = dup.claveOpciones(['Cubo', 'Triángulo', 'Círculo', 'Circunferencia'])
    expect(a).toBe(b)
  })

  it('NO empareja dos preguntas que cambian una sola opción', () => {
    // El caso de Laura Zurdo: la discrepancia de clave viajaba disfrazada de opción distinta.
    const a = dup.claveOpciones(['65.535', '64.000', '32.767', '16.384'])
    const b = dup.claveOpciones(['65.535', '60.000', '32.767', '16.384'])
    expect(a).not.toBe(b)
  })

  it('descarta las opciones vacías: hay oposiciones de 3 alternativas POR DISEÑO', () => {
    // Policía Nacional: 989 de 991 oficiales con la D nula. Si la D vacía contase, todas
    // esas preguntas compartirían un trozo de clave y se emparejarían entre sí.
    const conD = dup.claveOpciones(['Sí', 'No', 'A veces', null])
    const sinD = dup.claveOpciones(['Sí', 'No', 'A veces'])
    expect(conD).toBe(sinD)
    expect(conD.split('|')).toHaveLength(3)
  })
})

describe('huellaContenido — el 97 % de los falsos positivos vivían aquí', () => {
  it('separa dos psicotécnicas que comparten enunciado genérico pero tienen figura distinta', () => {
    const a = dup.huellaContenido({ imageUrl: 'https://x/serie-1.png', contentData: {} })
    const b = dup.huellaContenido({ imageUrl: 'https://x/serie-2.png', contentData: {} })
    expect(a).not.toBe(b)
  })

  it('separa dos rejillas distintas aunque no haya imagen', () => {
    const a = dup.huellaContenido({ contentData: { tables: [{ rows: [['a', 'b']] }] } })
    const b = dup.huellaContenido({ contentData: { tables: [{ rows: [['a', 'c']] }] } })
    expect(a).not.toBe(b)
  })

  it('empareja el mismo contenido aunque las claves del JSON vengan en otro orden', () => {
    const a = dup.huellaContenido({ contentData: { chart: 'x', total: 3 } })
    const b = dup.huellaContenido({ contentData: { total: 3, chart: 'x' } })
    expect(a).toBe(b)
  })

  it('trata «sin contenido» de forma estable', () => {
    expect(dup.huellaContenido({})).toBe(dup.huellaContenido({ imageUrl: null, contentData: null }))
  })
})

describe('bandaGrupo — se compara el TEXTO de la respuesta, nunca el índice', () => {
  it('marca error cuando las gemelas responden cosas distintas', () => {
    expect(dup.bandaGrupo([
      { textoCorrecta: '65.535' },
      { textoCorrecta: '64.000' },
    ])).toBe('error')
  })

  it('marca warn cuando es la misma respuesta con distinta puntuación', () => {
    // Con los índices, este grupo habría gritado «clave contradictoria»: las opciones estaban
    // barajadas y correct_option valía 1 en una copia y 2 en la otra.
    expect(dup.bandaGrupo([
      { textoCorrecta: 'Serio.' },
      { textoCorrecta: 'Serio' },
    ])).toBe('warn')
  })
})

describe('decidirSuperviviente — quién se queda', () => {
  const base = { oficial: false, expl: 0, servida: 0, alta: '2026-01-01' }

  it('la de examen oficial gana a todo lo demás', () => {
    const [queda] = dup.decidirSuperviviente([
      { ...base, id: 'generada', expl: 900, servida: 500 },
      { ...base, id: 'oficial', oficial: true },
    ])
    expect(queda.id).toBe('oficial')
  })

  it('a igualdad de origen, gana la que tiene explicación', () => {
    const [queda] = dup.decidirSuperviviente([
      { ...base, id: 'sin-expl', servida: 10 },
      { ...base, id: 'con-expl', expl: 300 },
    ])
    expect(queda.id).toBe('con-expl')
  })

  it('a igualdad de explicación, gana la más servida (tiene el historial de respuestas)', () => {
    const [queda, fuera] = dup.decidirSuperviviente([
      { ...base, id: 'poco', expl: 100, servida: 2 },
      { ...base, id: 'mucho', expl: 100, servida: 400 },
    ])
    expect(queda.id).toBe('mucho')
    expect(fuera.map((f: { id: string }) => f.id)).toEqual(['poco'])
  })

  it('devuelve TODAS las sobrantes cuando el grupo tiene más de dos copias', () => {
    const [, fuera] = dup.decidirSuperviviente([
      { ...base, id: 'a' }, { ...base, id: 'b' }, { ...base, id: 'c' }, { ...base, id: 'd' },
    ])
    expect(fuera).toHaveLength(3)
  })
})

describe('unidoSoloPorTildes — no borrar la diferencia que la pregunta pregunta', () => {
  it('avisa cuando lo único que unió al grupo fue quitar la tilde', () => {
    // Caso real del banco (c3e10f4e / a01cda84): «cómo salir» y «como salir». Aquí es una errata,
    // pero en una pregunta de ortografía la tilde ES la respuesta, y entonces fusionar borra
    // justo lo que se examina. Por eso se aparta en vez de aplicarse solo.
    expect(dup.unidoSoloPorTildes([
      ['Situación embarazosa, conflicto del cual no se sabe cómo salir'],
      ['Situación embarazosa, conflicto del cual no se sabe como salir.'],
    ])).toBe(true)
  })

  it('NO avisa cuando la diferencia es solo el punto final o el orden', () => {
    // 13 de los 40 grupos medidos el 31/07 son de este tipo: transcripción, no contenido.
    // Apartarlos también dejaría la herramienta sin nada que hacer.
    expect(dup.unidoSoloPorTildes([
      ['Serio', 'Tolerante', 'Cohibido', 'Zalamero'],
      ['Zalamero.', 'Cohibido.', 'Serio.', 'Tolerante.'],
    ])).toBe(false)
  })

  it('NO avisa cuando las copias son idénticas', () => {
    expect(dup.unidoSoloPorTildes([['Círculo', 'Cubo'], ['Cubo', 'Círculo']])).toBe(false)
  })

  it('la ñ no cuenta como tilde en ninguno de los dos caminos', () => {
    expect(dup.normalizarConTildes('año')).toBe('año')
    expect(dup.unidoSoloPorTildes([['año'], ['año']])).toBe(false)
  })
})

describe('esJuegoGenerico — solo para el corte parafraseado', () => {
  it('descarta los juegos de cifras sueltas y los de «figura A/B/C/D»', () => {
    expect(dup.esJuegoGenerico('13|14|16|18')).toBe(true)
    expect(dup.esJuegoGenerico('figuraa|figurab|figurac|figurad')).toBe(true)
  })

  it('descarta los juegos demasiado cortos para ser evidencia', () => {
    expect(dup.esJuegoGenerico('si|no|nose')).toBe(true)
  })

  it('acepta un juego de vocabulario, que es donde vive el duplicado parafraseado', () => {
    expect(dup.esJuegoGenerico('coherencia|desequilibrio|desnivel|paridad')).toBe(false)
  })
})

describe('sqlNormalizar — el gemelo en SQL del normalizador', () => {
  it('interpola la columna que se le pasa', () => {
    expect(dup.sqlNormalizar('q.question_text')).toContain('q.question_text')
  })

  it('conserva la ñ también en SQL (no está en la tabla de translate)', () => {
    const sql = dup.sqlNormalizar('x')
    expect(sql).not.toMatch(/translate\([^)]*ñ/)
    expect(sql).toContain('[^a-z0-9ñ]+')
  })
})
