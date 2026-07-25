const { analizarCita } = require('../../../lib/generacion/citaTruncada')

// Todos los casos salen de defectos REALES detectados en los batches del
// Bloque II de T-045, no de ejemplos inventados.

describe('analizarCita — detección de cita truncada', () => {
  // --- Verdaderos positivos: la cita omite una cláusula que la condiciona ---

  it('detecta la cita truncada del ISD art. 3.1.c (caso que motivó el check)', () => {
    const articulo =
      'La percepción de cantidades por los beneficiarios de contratos de seguros sobre la vida, ' +
      'cuando el contratante sea persona distinta del beneficiario, salvo los supuestos expresamente ' +
      'regulados en el artículo 16.2, a), de la Ley del Impuesto sobre la Renta de las Personas Físicas.'
    const cita =
      'La percepción de cantidades por los beneficiarios de contratos de seguros sobre la vida, ' +
      'cuando el contratante sea persona distinta del beneficiario'
    expect(analizarCita(articulo, cita).estado).toBe('TRUNCADA')
  })

  it('detecta truncamiento ante una cláusula coordinada con "así como"', () => {
    const articulo = 'Los principios de eficacia y jerarquía, así como los órganos de coordinación previstos en el título III.'
    const cita = 'Los principios de eficacia y jerarquía'
    expect(analizarCita(articulo, cita).estado).toBe('TRUNCADA')
  })

  it('devuelve la cola omitida para poder diagnosticar', () => {
    const articulo = 'El sujeto pasivo responderá del pago, sin perjuicio de la responsabilidad subsidiaria del artículo 8.'
    const cita = 'El sujeto pasivo responderá del pago'
    const r = analizarCita(articulo, cita)
    expect(r.estado).toBe('TRUNCADA')
    expect(r.cola).toContain('sin perjuicio')
  })

  // --- Verdaderos negativos: la cita está completa ---

  it('acepta la cita del ISD art. 3.1.c una vez reparada (incluye la excepción)', () => {
    const articulo =
      'La percepción de cantidades por los beneficiarios de contratos de seguros sobre la vida, ' +
      'cuando el contratante sea persona distinta del beneficiario, salvo los supuestos expresamente ' +
      'regulados en el artículo 16.2, a), de la Ley del Impuesto sobre la Renta de las Personas Físicas.'
    const cita =
      'La percepción de cantidades por los beneficiarios de contratos de seguros sobre la vida, ' +
      'cuando el contratante sea persona distinta del beneficiario, salvo los supuestos expresamente ' +
      'regulados en el artículo 16.2, a), de la Ley del Impuesto sobre la Renta de las Personas Físicas'
    expect(analizarCita(articulo, cita).estado).toBe('OK')
  })

  // --- Falsos positivos que hubo que corregir (batch gen_patrimonio) ---

  it('NO marca truncada cuando lo que sigue es una frase nueva tras punto (Ley 19/1991 art. 5.Uno)', () => {
    const articulo =
      'Por obligación personal, las personas físicas que tengan su residencia habitual en territorio español. ' +
      'Cuando un residente en territorio español pase a tener su residencia en otro país podrá optar por seguir tributando.'
    const cita = 'Por obligación personal, las personas físicas que tengan su residencia habitual en territorio español'
    expect(analizarCita(articulo, cita).estado).toBe('OK')
  })

  it('tolera que al `content` importado le falte el punto final (Ley 19/1991 art. 4.Cuatro)', () => {
    // El artículo en BD llegó sin punto final; la cita sí lo lleva.
    const articulo = 'El ajuar doméstico, excepto los bienes a los que se refieren los artículos 18 y 19 de esta Ley'
    const cita = 'El ajuar doméstico, excepto los bienes a los que se refieren los artículos 18 y 19 de esta Ley.'
    expect(analizarCita(articulo, cita).estado).toBe('OK')
  })

  // --- Cita que directamente no está en el artículo ---

  it('marca NO_LITERAL si la opción no aparece en el artículo', () => {
    const articulo = 'El impuesto se devengará el 31 de diciembre de cada año.'
    const cita = 'El impuesto se devengará el 30 de junio de cada año.'
    expect(analizarCita(articulo, cita).estado).toBe('NO_LITERAL')
  })
})

// --- Truncamiento por la CABEZA (25/07/2026) ---
// La cláusula condicionante va DELANTE de la cita, intercalada entre comas.
// El corte de cola no lo veía: la cita era subcadena literal y terminaba en punto.

describe('analizarCita — truncamiento por la cabeza', () => {
  const ART_63_3 =
    'En los casos de ejecución forzosa en que se hubieran acumulado varias deudas tributarias del mismo obligado tributario y no pudieran extinguirse totalmente, la Administración tributaria, salvo lo dispuesto en el apartado siguiente, aplicará el pago a la deuda más antigua. Su antigüedad se determinará de acuerdo con la fecha en que cada una fue exigible.'

  it('marca la cita que arranca justo después de un "salvo" intercalado (art. 63.3 LGT)', () => {
    const cita = 'Aplicará el pago a la deuda más antigua. Su antigüedad se determinará de acuerdo con la fecha en que cada una fue exigible.'
    const r = analizarCita(ART_63_3, cita)
    expect(r.estado).toBe('TRUNCADA')
    expect(r.lado).toBe('cabeza')
    expect(r.cola).toMatch(/salvo lo dispuesto en el apartado siguiente/)
  })

  it('NO marca si la cita incorpora el inciso condicionante', () => {
    const cita = 'la Administración tributaria, salvo lo dispuesto en el apartado siguiente, aplicará el pago a la deuda más antigua'
    expect(analizarCita(ART_63_3, cita).estado).toBe('OK')
  })

  it('NO marca una cita que empieza en mitad de frase sin inciso condicionante delante', () => {
    const art = 'El obligado al pago de varias deudas podrá imputar cada pago a la deuda que libremente determine.'
    expect(analizarCita(art, 'podrá imputar cada pago a la deuda que libremente determine').estado).toBe('OK')
  })

  it('NO marca cuando lo que precede es una enumeración con comas, no un inciso "salvo"', () => {
    const art = 'Las deudas tributarias podrán extinguirse por pago, prescripción, compensación o condonación, por los medios previstos en la normativa aduanera.'
    expect(analizarCita(art, 'por los medios previstos en la normativa aduanera').estado).toBe('OK')
  })
})
