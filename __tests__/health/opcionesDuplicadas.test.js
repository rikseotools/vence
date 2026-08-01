/**
 * @jest-environment node
 */
// T-406. Los tres primeros casos NO son hipótesis: son los falsos positivos que se midieron de
// verdad el 31/07 al construir la consulta, y cada uno costó una tanda de fantasmas.
const {
  normalizarOpcion, paresDuplicados, tieneOpcionesDuplicadas, clasificarLote,
} = require('@/lib/health/opcionesDuplicadas.cjs')

const pregunta = (opts, correct = 0, id = 'q1') => ({
  id,
  option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
  correct_option: correct,
})

describe('normalizarOpcion — lo ÚNICO que se normaliza es el espacio', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizarOpcion('  el   órgano   de contratación ')).toBe('el órgano de contratación')
  })

  it('NO toca mayúsculas ni tildes: ahí es donde nacieron los falsos positivos', () => {
    expect(normalizarOpcion('Público')).toBe('Público')
    expect(normalizarOpcion('publico')).toBe('publico')
  })

  it('vacío y null son lo mismo: null', () => {
    expect(normalizarOpcion(null)).toBeNull()
    expect(normalizarOpcion('')).toBeNull()
    expect(normalizarOpcion('   ')).toBeNull()
  })
})

describe('paresDuplicados — las dos bandas', () => {
  it('(d) par de DISTRACTORES → warn: la pregunta sigue siendo resoluble', () => {
    // clave en A; el par clonado es C/D.
    const r = paresDuplicados(pregunta(['correcta', 'otra', 'clon', 'clon'], 0))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ i: 2, j: 3, banda: 'warn' })
  })

  it('(e) par que INCLUYE la clave → error: se acierta y se falla a la vez', () => {
    // Da igual cuál marque el opositor: las dos son la respuesta y solo una puntúa.
    const r = paresDuplicados(pregunta(['clon', 'otra', 'clon', 'cuarta'], 0))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ i: 0, j: 2, banda: 'error' })
  })

  it('la banda mira la clave, no la posición: mismo par, clave dentro o fuera', () => {
    const opts = ['una', 'clon', 'clon', 'otra']
    expect(paresDuplicados(pregunta(opts, 1))[0].banda).toBe('error')
    expect(paresDuplicados(pregunta(opts, 0))[0].banda).toBe('warn')
  })

  it('(a) FALSO POSITIVO REAL: dos opciones que solo difieren en mayúsculas NO son par', () => {
    expect(paresDuplicados(pregunta(['Público', 'público', 'otra', 'cuarta'], 3))).toEqual([])
  })

  it('difieren en una sola letra → no son par (el caso wardrobes/wardrobess)', () => {
    // Salió de una regex `\s+` que llegó a SQL como `s+` y borraba las eses: 8 fantasmas.
    expect(paresDuplicados(pregunta(['wardrobes', 'wardrobess', 'otra', 'cuarta'], 3))).toEqual([])
  })

  it('(b) una opción VACÍA no forma par con otra vacía', () => {
    expect(paresDuplicados(pregunta(['una', 'otra', '', ''], 0))).toEqual([])
    expect(paresDuplicados(pregunta(['una', 'otra', null, null], 0))).toEqual([])
  })

  it('(c) la D nula legítima de las oposiciones de TRES opciones no dispara nada', () => {
    // Policía Nacional sirve 989 de sus 991 oficiales con la D vacía (impugnaciones §7.8).
    expect(tieneOpcionesDuplicadas(pregunta(['una', 'otra', 'tercera', null], 1))).toBe(false)
  })

  it('el espacio de más SÍ se ignora: son la misma opción para quien la lee', () => {
    const r = paresDuplicados(pregunta(['la  opción', 'la opción', 'otra', 'cuarta'], 2))
    expect(r).toHaveLength(1)
    expect(r[0].banda).toBe('warn')
  })

  it('tres opciones iguales dan los tres pares, no uno', () => {
    expect(paresDuplicados(pregunta(['x', 'x', 'x', 'otra'], 3))).toHaveLength(3)
  })

  it('una pregunta sana no produce nada, y tolera la entrada vacía', () => {
    expect(paresDuplicados(pregunta(['a', 'b', 'c', 'd'], 0))).toEqual([])
    expect(paresDuplicados(null)).toEqual([])
    expect(paresDuplicados({})).toEqual([])
  })
})

describe('clasificarLote — lo que consume el barrido', () => {
  it('separa por banda y conserva el id, para poder ir a la pregunta', () => {
    const r = clasificarLote([
      pregunta(['clon', 'otra', 'clon', 'x'], 0, 'rota'),      // clave dentro → error
      pregunta(['ok', 'dos', 'dos', 'x'], 0, 'fea'),           // distractores → warn
      pregunta(['a', 'b', 'c', 'd'], 0, 'sana'),
    ])
    expect(r.errores.map((e) => e.id)).toEqual(['rota'])
    expect(r.avisos.map((e) => e.id)).toEqual(['fea'])
    expect(r.total).toBe(2)
  })

  it('nace en VERDE: un banco sano no produce hallazgos (es un trinquete, no una bandeja)', () => {
    expect(clasificarLote([pregunta(['a', 'b', 'c', 'd'], 0)])).toEqual({ errores: [], avisos: [], total: 0 })
    expect(clasificarLote([])).toEqual({ errores: [], avisos: [], total: 0 })
  })
})
