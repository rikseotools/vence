const { analizarOverclaim, razonamientoDe } = require('../../../lib/generacion/overclaimExplicacion')

// Texto REAL del art. 5 LBRL (el caso que motivó el detector).
const ART_5_LBRL =
  'Para el cumplimiento de sus fines y en el ámbito de sus respectivas competencias, las Entidades locales, ' +
  'de acuerdo con la Constitución y las leyes, tendrán plena capacidad jurídica para adquirir, poseer, ' +
  'reivindicar, permutar, gravar o enajenar toda clase de bienes, celebrar contratos, establecer y explotar ' +
  'obras o servicios públicos, obligarse, interponer los recursos establecidos y ejercitar las acciones ' +
  'previstas en las leyes.'

// Texto REAL del art. 2.2 LBRL: el absoluto "en todo caso" lo dice LA LEY.
const ART_2_LBRL =
  'Las Leyes básicas del Estado previstas constitucionalmente deberán determinar las competencias que ellas ' +
  'mismas atribuyan o que, en todo caso, deban corresponder a los entes locales en las materias que regulen.'

const explicacion = (razon) =>
  `> **Art. X**\n> "cita literal de la ley"\n\n**Por qué C es correcta:** ${razon}\n\n` +
  `**Por qué las demás son incorrectas:**\n- **A)** …\n- **B)** …\n- **D)** …`

describe('analizarOverclaim (§ explicación que afirma más que el artículo)', () => {
  it('caza el defecto real del art. 5 LBRL: "sin excluir clase alguna de bienes"', () => {
    const r = analizarOverclaim(
      explicacion('el artículo reconoce plena capacidad jurídica, sin excluir clase alguna de bienes.'),
      ART_5_LBRL
    )
    expect(r.avisos.map((a) => a.termino)).toEqual(expect.arrayContaining(['sin excluir', 'clase alguna']))
    expect(r.avisos[0].frase).toMatch(/sin excluir clase alguna/)
  })

  it('da por buena la explicación reparada (sitúa el límite en el art. 80)', () => {
    const r = analizarOverclaim(
      explicacion(
        'reproduce el precepto tal cual: la capacidad es plena, se predica de "toda clase de bienes" y se ' +
          'ejerce "de acuerdo con la Constitución y las leyes" —que es donde operan los límites, como la ' +
          'inalienabilidad de los bienes de dominio público del artículo 80—.'
      ),
      ART_5_LBRL
    )
    expect(r.avisos).toEqual([])
  })

  it('NO marca el absoluto que dice la propia ley ("en todo caso" del art. 2.2 LBRL)', () => {
    const r = analizarOverclaim(
      explicacion('el mandato alcanza a las que, en todo caso, deban corresponder a los entes locales.'),
      ART_2_LBRL
    )
    expect(r.avisos).toEqual([])
  })

  it('distingue "siempre que" (condición) de "siempre" (absoluto)', () => {
    const cond = analizarOverclaim(explicacion('procede siempre que se cumplan los requisitos.'), ART_5_LBRL)
    expect(cond.avisos).toEqual([])

    const abs = analizarOverclaim(explicacion('la entidad local puede siempre enajenar sus bienes.'), ART_5_LBRL)
    expect(abs.avisos.map((a) => a.termino)).toContain('siempre')
  })

  it('ignora el blockquote: los absolutos de la cita son palabras del legislador', () => {
    const conCita =
      '> **Art. X**\n> "Los bienes comunales son inalienables en todo caso y nunca prescriben."\n\n' +
      '**Por qué C es correcta:** reproduce el precepto.\n\n**Por qué las demás son incorrectas:**\n- **A)** …'
    expect(analizarOverclaim(conCita, ART_5_LBRL).avisos).toEqual([])
  })

  it('razonamientoDe elimina las líneas de cita y conserva el resto', () => {
    const r = razonamientoDe('> cita\n> más cita\n\n**Por qué A es correcta:** razón.')
    expect(r).not.toMatch(/cita/)
    expect(r).toMatch(/razón/)
  })

  // Calibrado sobre 4.000 explicaciones activas: en los bullets el absoluto casi
  // siempre se está NEGANDO (es correcto), y marcarlo convertía el aviso en ruido.
  it('NO marca el absoluto que vive en un bullet de distractor (ahí se está negando)', () => {
    const exp =
      '> **Art. X**\n> "cita"\n\n**Por qué B es correcta:** reproduce el precepto.\n\n' +
      '**Por qué las demás son incorrectas:**\n' +
      '- **A)** no queda exento "en todo caso": subsiste la responsabilidad por los actos ya ejecutados.\n' +
      '- **C)** la identidad del funcionario nunca es automática.\n- **D)** …'
    expect(analizarOverclaim(exp, ART_5_LBRL).avisos).toEqual([])
  })

  it('si falta la cabecera canónica, analiza el texto entero (no se calla)', () => {
    const r = analizarOverclaim('La entidad puede enajenar sin excepción cualquier bien.', ART_5_LBRL)
    expect(r.avisos.map((a) => a.termino)).toContain('sin excepción')
  })

  it('tolera entradas vacías o nulas', () => {
    expect(analizarOverclaim('', '').avisos).toEqual([])
    expect(analizarOverclaim(undefined, undefined).avisos).toEqual([])
  })
})
