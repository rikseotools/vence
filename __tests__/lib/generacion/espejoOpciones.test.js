const { sonEspejo, claveTieneDistractorEspejo } = require('@/lib/generacion/espejoOpciones')

describe('sonEspejo — mismo texto salvo un término invertido', () => {
  it('detecta el par superior/inferior', () => {
    expect(sonEspejo(
      'El importe a ingresar es superior a la cuota autoliquidada.',
      'El importe a ingresar es inferior a la cuota autoliquidada.',
    )).toBe(true)
  })

  it('detecta el par podrá/no podrá', () => {
    expect(sonEspejo(
      'El órgano podrá acordar la suspensión cautelar del procedimiento.',
      'El órgano no podrá acordar la suspensión cautelar del procedimiento.',
    )).toBe(true)
  })

  it('funciona en las dos direcciones (da igual cuál sea la clave)', () => {
    const c = 'El recurso procede ante el órgano superior jerárquico.'
    const d = 'El recurso no procede ante el órgano superior jerárquico.'
    expect(sonEspejo(c, d)).toBe(true)
    expect(sonEspejo(d, c)).toBe(true)
  })

  it('la negación simple es genérica: cualquier verbo con un "no" insertado es espejo, no solo los catalogados', () => {
    // "computa"/"no computa" no está en PARES_INVERTIDOS a propósito: la regla de
    // negación no depende de una lista cerrada de verbos, solo de que la ÚNICA
    // diferencia entre las dos opciones sea un "no".
    expect(sonEspejo(
      'El plazo se computa desde el día siguiente al de la notificación.',
      'El plazo no se computa desde el día siguiente al de la notificación.',
    )).toBe(true)
  })

  it('NO marca textos idénticos', () => {
    const t = 'El plazo de resolución es de tres meses.'
    expect(sonEspejo(t, t)).toBe(false)
  })

  it('NO marca textos sin relación (no son variaciones del mismo texto)', () => {
    expect(sonEspejo(
      'El órgano competente resolverá conforme al procedimiento ordinario.',
      'El plazo de prescripción es de cuatro años desde el hecho imponible.',
    )).toBe(false)
  })

  it('NO marca cuando además del término invertido hay otro cambio sustantivo', () => {
    // Mismo par (superior/inferior) pero el resto del texto también cambia: no es UNA
    // sola inversión, es una reescritura — no debe contar como espejo.
    expect(sonEspejo(
      'El importe a ingresar es superior a la cuota autoliquidada por el sujeto pasivo.',
      'El importe a devolver es inferior a la cuota comprobada por la Administración.',
    )).toBe(false)
  })

  it('tolera texto vacío o nulo sin reventar', () => {
    expect(sonEspejo('', 'algo')).toBe(false)
    expect(sonEspejo(null, undefined)).toBe(false)
  })
})

describe('claveTieneDistractorEspejo — la clave y UN distractor son espejo', () => {
  it('encuentra el distractor espejo de la clave, sea cual sea su posición', () => {
    const options = [
      'El plazo se interrumpe por la interposición del recurso.',
      'El plazo no se interrumpe por la interposición del recurso.', // espejo del A vía "interrumpe/no interrumpe"
      'El plazo se suspende por causa de fuerza mayor debidamente acreditada.',
      'El plazo se reinicia el día siguiente a la notificación de la resolución.',
    ]
    const r = claveTieneDistractorEspejo(options, 0)
    expect(r.esEspejo).toBe(true)
    expect(r.distractorIdx).toBe(1)
  })

  it('NO marca si ningún distractor es espejo de la clave (aunque dos distractores lo sean entre sí)', () => {
    // B y C son un par espejo entre ELLOS, pero ninguno lo es de la clave (A): el atajo
    // "elige uno de los dos extremos" no revela nada porque los dos son incorrectos.
    const options = [
      'La solicitud se tramitará por el procedimiento abreviado previsto en la norma.',
      'El recurso procede ante el órgano superior jerárquico.',
      'El recurso no procede ante el órgano superior jerárquico.',
      'La resolución se notificará en el plazo máximo de diez días hábiles.',
    ]
    const r = claveTieneDistractorEspejo(options, 0)
    expect(r.esEspejo).toBe(false)
  })

  it('tolera correctIdx en cualquier posición', () => {
    const options = [
      'El acto es nulo de pleno derecho por infracción manifiesta de la ley.', // espejo de la clave (idx 2)
      'La resolución se dicta en el plazo de un mes desde la solicitud.',
      'El acto es válido de pleno derecho por infracción manifiesta de la ley.', // clave
      'El expediente se archiva por desistimiento del interesado.',
    ]
    const r = claveTieneDistractorEspejo(options, 2)
    expect(r.esEspejo).toBe(true)
    expect(r.distractorIdx).toBe(0)
  })
})
