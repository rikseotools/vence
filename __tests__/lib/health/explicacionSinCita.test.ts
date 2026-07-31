// @ts-nocheck
const { clasificar, esNegacion, esMetaOpcion, esHallazgo } = require('@/lib/health/explicacionSinCita')
const { citaNoLiteral } = require('@/scripts/impugnaciones/validar-explicacion.cjs')

const ART = 'El plazo máximo para resolver será de tres meses desde la solicitud. Transcurrido dicho plazo sin resolución expresa, se entenderá estimada.'

const q = (over = {}) => ({
  explanationData: { v: 1, options: { 0: 'a', 1: 'b' } },
  enunciado: '¿Cuál es el plazo máximo para resolver?',
  textoClave: 'Tres meses',
  contenidoArticulo: ART,
  ...over,
})

describe('el criterio de literalidad es el ÚNICO del proyecto, no una copia', () => {
  it('usa el citaNoLiteral de impugnaciones y por eso una cita verbatim pasa', () => {
    const r = clasificar(q({ explanationData: { cita: { texto: 'El plazo máximo para resolver será de tres meses desde la solicitud.' } } }), citaNoLiteral)
    expect(r.estado).toBe('con_cita_literal')
  })

  it('y una cita que NO está en el artículo se marca, aunque tenga buena pinta', () => {
    const r = clasificar(q({ explanationData: { cita: { texto: 'El plazo máximo para resolver será de seis meses desde la solicitud.' } } }), citaNoLiteral)
    expect(r.estado).toBe('cita_no_literal')
  })
})

describe('el alcance del detector está ACOTADO a su novedad', () => {
  it('«cita no literal» se calcula, pero NO es hallazgo de este detector: lo cubre el barrido de citas con su propia calibración', () => {
    expect(esHallazgo('cita_no_literal')).toBe(false)
    // sin esta acotación el detector reportaría 3.925 de 7.037 activas (medido el 30/07): un badge gritando
  })
  it('los estados exentos y el literal tampoco son hallazgo', () => {
    for (const e of ['con_cita_literal', 'exento_negacion', 'exento_meta', 'sin_estructura']) expect(esHallazgo(e)).toBe(false)
  })
})

describe('sin cita = huella de que el artículo no sostiene la respuesta', () => {
  it('una explicación estructurada sin cita es hallazgo', () => {
    expect(clasificar(q(), citaNoLiteral).estado).toBe('sin_cita')
    expect(esHallazgo('sin_cita')).toBe(true)
  })

  it('una pregunta sin estructura queda fuera de alcance: no tiene dónde dejar el rastro', () => {
    expect(clasificar(q({ explanationData: null }), citaNoLiteral).estado).toBe('sin_estructura')
    expect(esHallazgo('sin_estructura')).toBe(false)
  })
})

describe('exención por NEGACIÓN — sin ella el detector grita en falso', () => {
  it.each([
    '¿Cuál de las siguientes NO es una función del órgano?',
    'Señale la respuesta INCORRECTA:',
    'Todas son competencias del Estado, excepto:',
    'Señale la falsa en relación con el plazo:',
    'Indique cuál de los siguientes no forma parte del procedimiento',
  ])('reconoce «%s»', (enunciado) => {
    expect(esNegacion(enunciado)).toBe(true)
    expect(clasificar(q({ enunciado }), citaNoLiteral).estado).toBe('exento_negacion')
  })

  it('una pregunta afirmativa normal NO se exime', () => {
    expect(esNegacion('¿Cuál es el plazo máximo para resolver?')).toBe(false)
  })

  it('la exención NO tapa una cita inventada: si la cita existe, se comprueba igual', () => {
    const r = clasificar(q({
      enunciado: '¿Cuál de las siguientes NO es correcta?',
      explanationData: { cita: { texto: 'Un texto que no está en el artículo en absoluto.' } },
    }), citaNoLiteral)
    expect(r.estado).toBe('cita_no_literal')
  })
})

describe('exención por META-OPCIÓN', () => {
  it.each(['Todas las respuestas son correctas', 'Ninguna es correcta', 'A y C son correctas', 'Las dos anteriores son correctas'])(
    'reconoce «%s»', (textoClave) => {
      expect(esMetaOpcion(textoClave)).toBe(true)
      expect(clasificar(q({ textoClave }), citaNoLiteral).estado).toBe('exento_meta')
    })

  it('una opción con contenido propio NO se exime', () => {
    expect(esMetaOpcion('Tres meses desde la solicitud')).toBe(false)
  })

  it('«todas» debe ir al PRINCIPIO: una opción que solo menciona la palabra no es meta-opción', () => {
    expect(esMetaOpcion('El plazo se aplica a todas las solicitudes')).toBe(false)
  })
})

describe('orden de comprobación', () => {
  it('la cita manda sobre las exenciones: si hay cita literal, el estado es ese aunque sea de negación', () => {
    const r = clasificar(q({
      enunciado: '¿Cuál NO es el plazo?',
      textoClave: 'Todas son correctas',
      explanationData: { cita: { texto: 'Transcurrido dicho plazo sin resolución expresa, se entenderá estimada.' } },
    }), citaNoLiteral)
    expect(r.estado).toBe('con_cita_literal')
  })

  it('acepta la cita en `bloque` además de en `texto`', () => {
    const r = clasificar(q({ explanationData: { cita: { bloque: 'El plazo máximo para resolver será de tres meses desde la solicitud.' } } }), citaNoLiteral)
    expect(r.estado).toBe('con_cita_literal')
  })
})
