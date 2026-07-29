/**
 * @jest-environment node
 */
// __tests__/health/autocontenida.test.ts
//
// §2.2-quater del manual de generación: cada pregunta debe ser AUTOCONTENIDA. La mitad de las
// siglas la vigila `lib/generacion/siglasSinDesarrollar.js` desde el 02/07; esta es la otra mitad
// —la referencia DESNUDA a la norma— y nace de la impugnación 6ed11712 de Esther Lázaro (29/07):
// «Porque no indica a qué normativa se refiere».
const {
  AC_DESNUDA,
  AC_IDENTIFICA,
  AC_SIGLA,
  citaNormaDesnuda,
  identificaSuNorma,
  classifyAutocontenida,
} = require('@/lib/health/autocontenida.cjs')

const marca = (questionText: string) => classifyAutocontenida({ questionText }).flagged

describe('el defecto: cita un artículo de una norma que no nombra', () => {
  it('caza el caso raíz de la impugnación', () => {
    expect(marca('El artículo 1 de la normativa, en su segundo párrafo, ¿qué establece?')).toBe(true)
  })

  it('caza la forma dominante del banco', () => {
    expect(marca('Según el artículo 75 de la ley, ¿cuál es el contenido mínimo del instrumento?')).toBe(true)
  })

  it('caza las variantes con apartado y con «dicha/esta»', () => {
    expect(marca('Según el artículo 13.2, párrafo segundo, de dicha ley, la cuantía se incrementará.')).toBe(true)
    expect(marca('Conforme al artículo 29 de esta normativa, el registro electrónico:')).toBe(true)
  })
})

describe('lo que NO se marca (y por qué)', () => {
  it('la norma nombrada con su número', () => {
    expect(marca('Según el artículo 110 de la Ley 39/2015, las facultades de revisión de dicha ley:')).toBe(false)
  })

  // El veredicto corta en cuanto no hay referencia desnuda, así que para llegar a
  // `nombra_su_norma` hace falta un enunciado que tenga LAS DOS cosas: la cita desnuda y, en otro
  // punto, el dato que identifica la norma. Es prosa correcta y no debe marcarse.
  it('cita desnuda PERO la norma se nombra en otro punto del enunciado', () => {
    const t = 'Según el artículo 110 de la ley, las facultades de revisión reguladas en la Ley 39/2015:'
    expect(marca(t)).toBe(false)
    expect(classifyAutocontenida({ questionText: t }).reason).toBe('nombra_su_norma')
  })

  it('la norma nombrada por sus siglas', () => {
    expect(marca('Según el artículo 523 LOPJ, aprobadas las relaciones de puestos de trabajo:')).toBe(false)
    expect(marca('Según el artículo 102.5 del RP, ¿cuál de los siguientes factores no se ponderará?')).toBe(false)
  })

  it('la norma nombrada por su título («Ley de Enjuiciamiento Criminal», «Código Civil»)', () => {
    expect(marca('Ley de Enjuiciamiento Criminal. Cuando no conste el lugar del delito, según la ley:')).toBe(false)
    expect(marca('Según el artículo 3 de la ley, el Código Civil dispone que:')).toBe(false)
  })

  it('la Constitución', () => {
    expect(marca('En el artículo 13 de la Constitución se establece que la extradición:')).toBe(false)
  })

  // La calibración que costó bajar de 391 a 274, medida sobre 20 al azar del banco: sin el ancla
  // al artículo, esta clase entera entraba como falso positivo.
  it('NO marca «conforme a la ley» como fórmula jurídica dentro del contenido', () => {
    expect(marca('¿Cómo se denominan los actos procesales que ordenan, conforme a la ley, una conducta?')).toBe(false)
    expect(classifyAutocontenida({ questionText: '¿…que ordenan, conforme a la ley, una conducta?' }).reason)
      .toBe('sin_referencia_desnuda')
  })

  it('NO marca la normativa que SÍ se identifica con un calificativo detrás', () => {
    expect(marca('Según el artículo 22 de la Normativa de evaluación de la Universidad de Granada:')).toBe(false)
  })
})

describe('contrato con el SQL de los dos gemelos del sweep', () => {
  it('los patrones se exportan en sintaxis de Postgres (`\\y`, no `\\b`)', () => {
    for (const p of [AC_DESNUDA, AC_IDENTIFICA]) {
      expect(p).toContain('\\y')
      expect(p).not.toContain('\\b')
    }
  })

  it('el patrón de SIGLAS va aparte porque es sensible a mayúsculas', () => {
    // Con `~*` esta clase casaría dos letras cualesquiera y daría por identificada cualquier
    // pregunta: por eso el sweep lo compara con `~` y no con `~*`.
    expect(AC_SIGLA).toBe('[A-ZÁÉÍÓÚÑ]{2,}')
    expect(identificaSuNorma('según el artículo 1 de la ley')).toBe(false)
    expect(identificaSuNorma('según el artículo 1 de la LOPJ')).toBe(true)
  })

  it('los predicados sueltos son coherentes con el veredicto', () => {
    const t = 'Según el artículo 75 de la ley, ¿cuál es el contenido mínimo?'
    expect(citaNormaDesnuda(t)).toBe(true)
    expect(identificaSuNorma(t)).toBe(false)
    expect(classifyAutocontenida({ questionText: t })).toEqual({ flagged: true, reason: 'norma_sin_nombrar' })
  })
})
