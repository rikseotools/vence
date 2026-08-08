const { analizaCitaBlockquote, fragmentosCitados } = require('../../../lib/generacion/citaBlockquote')

// Texto real del art. 116 bis.3 de la LBRL, que es el que motivó el check: usa
// «La Diputación PROVINCIAL o entidad equivalente asistirá…» en la primera frase y
// «La Diputación o entidad equivalente propondrá y coordinará…» en la segunda.
const ART_116BIS3 =
  'La Diputación provincial o entidad equivalente asistirá al resto de corporaciones locales y colaborará con la Administración que ejerza la tutela financiera. ' +
  'La Diputación o entidad equivalente propondrá y coordinará las medidas recogidas en el apartado anterior cuando tengan carácter supramunicipal, que serán valoradas antes de aprobarse el plan económico-financiero.'

const explicacion = (cita) => `> **Art. 116 bis.3 de la Ley 7/1985**\n> "${cita}"\n\n**Por qué B es correcta:** …`

describe('analizaCitaBlockquote', () => {
  it('caza la palabra AÑADIDA dentro de una cita presentada como literal', () => {
    // El defecto real: se coló «provincial» en la segunda frase, donde la ley no lo dice.
    const r = analizaCitaBlockquote(
      explicacion('La Diputación provincial o entidad equivalente propondrá y coordinará las medidas recogidas en el apartado anterior'),
      ART_116BIS3)
    expect(r.literal).toBe(false)
    expect(r.divergencias).toHaveLength(1)
  })

  it('acepta la cita correcta', () => {
    const r = analizaCitaBlockquote(
      explicacion('La Diputación o entidad equivalente propondrá y coordinará las medidas recogidas en el apartado anterior'),
      ART_116BIS3)
    expect(r.literal).toBe(true)
    expect(r.comprobados).toBe(1)
  })

  it('acepta que la cita SALTE de un apartado a otro con puntos suspensivos', () => {
    // Cada tramo debe ser contiguo en la ley; el salto no invalida la cita.
    const r = analizaCitaBlockquote(
      explicacion('La Diputación provincial o entidad equivalente asistirá al resto de corporaciones locales … cuando tengan carácter supramunicipal'),
      ART_116BIS3)
    expect(r.literal).toBe(true)
    expect(r.comprobados).toBe(2)
  })

  it('no se rompe por puntuación perdida en el import ni por comillas tipográficas', () => {
    const r = analizaCitaBlockquote(
      '> **Art. 116 bis.3**\n> «La Diputación o entidad equivalente propondrá y coordinará las medidas recogidas en el apartado anterior.»',
      ART_116BIS3.replace('supramunicipal,', 'supramunicipal'))
    expect(r.literal).toBe(true)
  })

  it('ignora los fragmentos demasiado cortos: no prueban nada y meten ruido', () => {
    const r = analizaCitaBlockquote(explicacion('inventado'), ART_116BIS3)
    expect(r.comprobados).toBe(0)
    expect(r.literal).toBe(true)
  })

  it('solo mira los blockquotes, no el resto de la explicación', () => {
    // Las comillas del cuerpo de la glosa citan a menudo con elipsis o paráfrasis;
    // el compromiso de literalidad es el del blockquote.
    const e = '> **Art. 116 bis.3**\n> "La Diputación o entidad equivalente propondrá y coordinará"\n\n**Por qué B es correcta:** el apartado habla de "medidas de alcance supramunicipal inventadas".'
    expect(analizaCitaBlockquote(e, ART_116BIS3).literal).toBe(true)
  })

  it('tolera que la cita y la ley usen ESTILOS DE COMILLA distintos', () => {
    // Caso real de calibración: el art. 87 bis.3 LJCA entrecomilla el Boletín Oficial
    // del Estado con comillas tipográficas dobles y la cita usaba angulares. Mismo
    // texto, distinto glifo: si eso da error, el check se vuelve inservible.
    const art = 'La Sala de Gobierno del Tribunal Supremo podrá determinar, mediante acuerdo que se publicará en el \u201CBolet\u00EDn Oficial del Estado\u201D, la extensi\u00F3n m\u00E1xima.'
    const exp = '> **Art. 87 bis.3**\n> "La Sala de Gobierno del Tribunal Supremo podr\u00E1 determinar, mediante acuerdo que se publicar\u00E1 en el \u00ABBolet\u00EDn Oficial del Estado\u00BB, la extensi\u00F3n m\u00E1xima."'
    expect(analizaCitaBlockquote(exp, art).literal).toBe(true)
  })

  it('fragmentosCitados separa por elipsis y descarta lo vacío', () => {
    expect(fragmentosCitados('> "uno … dos ... tres"')).toEqual(['uno', 'dos', 'tres'])
  })
})

describe('la elipsis entre PARÉNTESIS también trocea (T-278, 08/08/2026)', () => {
  // El manual sanciona las dos formas de marcar una omisión: «...» y «(...)». Troceando solo por
  // los puntos, el paréntesis se quedaba pegado al tramo —«…también especiales (»— y ningún tramo
  // era ya subcadena del artículo. Medido al insertar Mecánico-Conductor T10: 3 de 22 en rojo,
  // las 3 correctas, y una de ellas reparada ANTES precisamente para cumplir la convención.
  const CITA = '> "Para vehículos especiales y conjuntos de vehículos, también especiales (...): ' +
    '1.º Si carecen de señalización de frenado: 25 kilómetros por hora."'

  it('no deja el paréntesis pegado a ningún tramo', () => {
    const frags = fragmentosCitados(CITA)
    expect(frags).toEqual([
      'Para vehículos especiales y conjuntos de vehículos, también especiales',
      ': 1.º Si carecen de señalización de frenado: 25 kilómetros por hora.',
    ])
    for (const f of frags) {
      expect(f.startsWith(')')).toBe(false)
      expect(f.endsWith('(')).toBe(false)
    }
  })

  it('la cita con «(...)» se da por literal contra el artículo real', () => {
    const articulo = 'Para vehículos especiales y conjuntos de vehículos, también especiales, ' +
      'aunque sólo tenga tal naturaleza uno de los que integran el conjunto: ' +
      '1.º Si carecen de señalización de frenado: 25 kilómetros por hora.'
    expect(analizaCitaBlockquote(CITA, articulo).literal).toBe(true)
  })

  it('y un paréntesis de VERDAD no se parte (el arreglo no ciega el check)', () => {
    expect(fragmentosCitados('> "lo previsto en el artículo 19.1 (del texto articulado) será exigible."'))
      .toEqual(['lo previsto en el artículo 19.1 (del texto articulado) será exigible.'])
  })

  it('sigue cazando una cita FALSEADA aunque lleve elipsis entre paréntesis', () => {
    const articulo = 'Para vehículos especiales: 1.º Si carecen de señalización: 25 kilómetros por hora.'
    const falsa = '> "Para vehículos especiales (...): 1.º Si carecen de señalización: 40 kilómetros por hora."'
    expect(analizaCitaBlockquote(falsa, articulo).literal).toBe(false)
  })
})
