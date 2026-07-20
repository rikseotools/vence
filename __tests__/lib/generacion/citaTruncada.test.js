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
