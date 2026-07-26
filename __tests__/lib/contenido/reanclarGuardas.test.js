/**
 * @jest-environment node
 */
// Guardas del re-anclaje de preguntas a otro artículo (T-139).
//
// Los casos son REALES: salieron el 26/07/2026 al vaciar la cola de contenido invisible por
// artículo inactivo escopado. Se fijan aquí porque el fallo que evitan es SILENCIOSO —
// re-anclar mal apaga el detector y deja la pregunta igual de invisible, o peor, huérfana.

const { evaluarReancla, relacionContenido, normalizar } = require('@/lib/contenido/reanclarGuardas')

// RD 1708/2011: la fila «2.2» era un trozo del art. 2, que está activo y escopado en los
// MISMOS dos temas. Es el caso limpio.
const FRAG_2_2 =
  'A los efectos de este Real Decreto se entiende por:\n\na) Sistema archivístico: Conjunto de normas reguladoras, así como de órganos, centros y servicios competentes en la gestión eficaz de los documentos y de los archivos.'
const ART_2 =
  'Artículo 2. Definiciones.\n\nA los efectos de este Real Decreto se entiende por:\n\na) Sistema archivístico: Conjunto de normas reguladoras, así como de órganos, centros y servicios competentes en la gestión eficaz de los documentos y de los archivos.\n\nb) Documento de archivo: Ejemplar en cualquier tipo de soporte.'

const T17 = 'auxiliar_administrativo_ayuntamiento_cordoba/T17'
const T13 = 'auxiliar_administrativo_diputacion_cordoba/T13'

const base = (over = {}) => ({
  origen: { id: 'o1', ley: 'RD 1708/2011', articulo: '2.2', contenido: FRAG_2_2 },
  destino: { id: 'd1', ley: 'RD 1708/2011', articulo: '2', contenido: ART_2, activo: true },
  temasOrigen: [T17, T13],
  temasDestino: [T17, T13, 'auxiliar_archivos_estado/T11'],
  ...over,
})

describe('reanclarGuardas — el caso limpio', () => {
  it('fragmento contenido en el padre activo y mismos temas → OK', () => {
    const r = evaluarReancla(base())
    expect(r.ok).toBe(true)
    expect(r.bloqueos).toEqual([])
    expect(r.relacion).toBe('contenido')
    expect(r.temasPerdidos).toEqual([])
    expect(r.temasGanados).toEqual(['auxiliar_archivos_estado/T11'])
  })
})

describe('reanclarGuardas — lo que NUNCA debe pasar', () => {
  it('destino INACTIVO se bloquea: la pregunta seguiría invisible', () => {
    // Este es el fallo que da un falso "arreglado": el detector se apaga porque el
    // artículo viejo se queda sin preguntas, y el opositor sigue sin verlas.
    const r = evaluarReancla(base({ destino: { id: 'd1', ley: 'RD 1708/2011', articulo: '2', contenido: ART_2, activo: false } }))
    expect(r.ok).toBe(false)
    expect(r.bloqueos.join(' ')).toMatch(/INACTIVO/)
  })

  it('destino sin ningún topic_scope se bloquea: dejaría la pregunta huérfana', () => {
    const r = evaluarReancla(base({ temasDestino: [] }))
    expect(r.ok).toBe(false)
    expect(r.bloqueos.join(' ')).toMatch(/huérfana/)
  })

  it('perder temas sin declararlo se bloquea', () => {
    const r = evaluarReancla(base({ temasDestino: [T17] }))
    expect(r.ok).toBe(false)
    expect(r.temasPerdidos).toEqual([T13])
    expect(r.bloqueos.join(' ')).toMatch(/dejaría de servirse/)
  })

  it('declarar la pérdida sin escribir el motivo tampoco vale', () => {
    const r = evaluarReancla(base({ temasDestino: [T17], permitirPerdidaTemas: true, motivoPerdida: '   ' }))
    expect(r.ok).toBe(false)
    expect(r.bloqueos.join(' ')).toMatch(/motivo/)
  })

  it('re-anclar al mismo artículo se bloquea', () => {
    const r = evaluarReancla(base({ destino: { id: 'o1', ley: 'RD 1708/2011', articulo: '2.2', contenido: FRAG_2_2, activo: true } }))
    expect(r.ok).toBe(false)
    expect(r.bloqueos.join(' ')).toMatch(/mismo artículo/)
  })
})

describe('reanclarGuardas — perder temas a propósito (caso CP → CE)', () => {
  // Real: dos preguntas sobre el Título III de la CONSTITUCIÓN colgaban del art. 93 del
  // CÓDIGO PENAL (colisión de número entre leyes distintas). Los temas que las servían son
  // de Código Penal, así que al llevarlas a la CE dejan de estar ahí — y es lo correcto:
  // una pregunta de la CE no pinta en un tema de Código Penal.
  it('con motivo escrito, la pérdida se permite y queda registrada como aviso', () => {
    const r = evaluarReancla({
      origen: { id: 'cp93', ley: 'CP', articulo: '93', contenido: '(Suprimido).' },
      destino: { id: 'ce0', ley: 'CE', articulo: '0', contenido: 'TÍTULO III - DE LAS CORTES GENERALES (Arts. 66-96): • Cap. III - Tratados internacionales (Arts. 93-96)', activo: true },
      temasOrigen: ['policia_nacional/T16', 'guardia_civil/T8'],
      temasDestino: ['administrativo_estado/T1'],
      permitirPerdidaTemas: true,
      motivoPerdida: 'la pregunta es de la CE; los temas de origen son de Código Penal y no la piden',
    })
    expect(r.ok).toBe(true)
    expect(r.temasPerdidos).toEqual(['policia_nacional/T16', 'guardia_civil/T8'])
    expect(r.avisos.join(' ')).toMatch(/A PROPÓSITO/)
  })

  it('sin parentesco textual avisa, pero no bloquea (glosa editorial, estructura de la norma)', () => {
    const r = evaluarReancla(base({
      origen: { id: 'o1', ley: 'Ley 40/2015', articulo: '69.1', contenido: 'España cuenta con 17 autonomías y dos ciudades autónomas.' },
      destino: { id: 'd1', ley: 'Ley 40/2015', articulo: '69', contenido: 'Existirá una Delegación del Gobierno en cada una de las Comunidades Autónomas.', activo: true },
    }))
    expect(r.ok).toBe(true)
    expect(r.relacion).toBe('ninguno')
    expect(r.avisos.join(' ')).toMatch(/criterio/)
  })
})

describe('relacionContenido — comparación de textos legales', () => {
  it('ignora acentos, puntuación y saltos de línea al comparar', () => {
    expect(relacionContenido('El Municipio, es la Entidad local.', 'art 5.  el municipio es la entidad local')).toBe('contenido')
  })

  it('un encabezado común NO cuenta como solapamiento', () => {
    const a = 'A los efectos de esta ley se entiende por: ' + 'x'.repeat(400)
    const b = 'A los efectos de esta ley se entiende por: ' + 'y'.repeat(400)
    expect(relacionContenido(a, b)).toBe('ninguno')
  })

  it('textos sin nada en común → ninguno', () => {
    expect(relacionContenido('prevención de riesgos laborales', 'presupuestos de las entidades locales')).toBe('ninguno')
  })

  it('contenido vacío no inventa parentesco', () => {
    expect(relacionContenido('', 'algo')).toBe('ninguno')
    expect(relacionContenido('algo', null)).toBe('ninguno')
  })

  it('normalizar deja solo alfanuméricos sin acentos', () => {
    expect(normalizar('Artículo 5.º — «Ñandú»')).toBe('articulo5nandu')
  })
})
