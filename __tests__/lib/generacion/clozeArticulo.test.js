const { esCloze, colaDelEnunciado } = require('@/lib/generacion/clozeArticulo')

// Réplica del patrón descrito en [T-153]: el enunciado cita literalmente el arranque de
// un tramo del artículo y la clave es la continuación verbatim — relleno de huecos.
const ART_6B =
  'Los tributos que establezcan las entidades locales respetarán, en todo caso, los siguientes principios: no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.'

describe('esCloze — el enunciado cita el arranque del artículo y la clave lo continúa', () => {
  it('detecta el patrón cloze clásico (enunciado termina en cita literal + clave = continuación)', () => {
    const enunciado =
      'Según el artículo 6.b) del TRLRHL, los tributos que establezcan las entidades locales respetarán, en todo caso, los siguientes principios:'
    const clave = 'no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.'
    expect(esCloze(ART_6B, enunciado, clave)).toBe(true)
  })

  it('NO marca cuando el enunciado PREGUNTA en vez de citar (arranca de otra forma)', () => {
    const enunciado = '¿Qué principio deben respetar los tributos que establezcan las entidades locales según el artículo 6.b) del TRLRHL?'
    const clave = 'No gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.'
    expect(esCloze(ART_6B, enunciado, clave)).toBe(false)
  })

  it('NO marca cuando la clave NO continúa el texto tras la cola citada (aunque la cola sea literal)', () => {
    const enunciado = 'Según el artículo 6.b) del TRLRHL, los tributos locales respetarán, en todo caso, los siguientes principios:'
    const clave = 'la igualdad de trato entre los contribuyentes de distintas entidades locales.' // no es lo que sigue en el artículo
    expect(esCloze(ART_6B, enunciado, clave)).toBe(false)
  })

  it('NO marca con una cola demasiado corta/genérica (evita falsos positivos triviales)', () => {
    const enunciado = 'Según el artículo 6.b):'
    const clave = 'no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.'
    expect(esCloze(ART_6B, enunciado, clave)).toBe(false)
  })

  it('tolera artículo, enunciado o clave vacíos/nulos sin reventar', () => {
    expect(esCloze('', 'algo', 'algo')).toBe(false)
    expect(esCloze(ART_6B, '', 'algo')).toBe(false)
    expect(esCloze(ART_6B, 'algo', '')).toBe(false)
    expect(esCloze(null, null, null)).toBe(false)
  })

  it('colaDelEnunciado quita la puntuación de cierre', () => {
    expect(colaDelEnunciado('Según el artículo 6.b), los tributos respetarán estos principios:')).toBe(
      'Según el artículo 6.b), los tributos respetarán estos principios',
    )
  })

  it('colaDelEnunciado se queda solo con las últimas 12 palabras si el enunciado es más largo', () => {
    const larga = 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce.'
    expect(colaDelEnunciado(larga)).toBe('tres cuatro cinco seis siete ocho nueve diez once doce trece catorce')
  })
})
