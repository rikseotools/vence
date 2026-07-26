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
