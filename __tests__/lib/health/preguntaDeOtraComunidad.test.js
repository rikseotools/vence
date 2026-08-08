/**
 * T-732 — distinguir la pregunta que EXAMINA normativa de otra comunidad de la que solo la MENCIONA.
 *
 * Los casos de este fichero NO son inventados: son las preguntas reales que aparecieron midiendo
 * `tcae_sermas_madrid` el 08/08/2026, incluidas las que engañaron a la primera medición. Si alguien
 * ensancha el criterio, estos casos dicen enseguida si ha vuelto a meter el ruido.
 */
const { comunidadesEn, ambiguasEn, clasificar } = require('../../../lib/health/preguntaDeOtraComunidad.cjs')

const MADRID = 'Comunidad de Madrid'

describe('comunidadesEn — la trampa que infló la medida de 164 a 2.493', () => {
  it('«casas», «tasas» y «masas» NO son el Servicio Andaluz de Salud', () => {
    expect(comunidadesEn('Las casas y las tasas de las masas del centro')).toEqual([])
  })

  it('pero SAS como sigla suelta sí se detecta', () => {
    expect(comunidadesEn('El personal del SAS tiene derecho a…')).toEqual([{ comunidad: 'Andalucía', evidencia: 'SAS' }])
  })

  it('la sigla se busca respetando mayúsculas: «sas» en minúscula no cuenta', () => {
    expect(comunidadesEn('el sas de la cuestión')).toEqual([])
  })

  it('reconoce el nombre de la comunidad sin distinguir mayúsculas ni tildes del uso corriente', () => {
    expect(comunidadesEn('normativa de castilla-la mancha')[0].comunidad).toBe('Castilla-La Mancha')
    expect(comunidadesEn('en ANDALUCIA se aplica')[0].comunidad).toBe('Andalucía')
  })

  it('no duplica la comunidad cuando salen sigla y nombre a la vez', () => {
    expect(comunidadesEn('El SAS, en Andalucía, dispone…')).toHaveLength(1)
  })
})

describe('clasificar — MENCIONAR no es EXAMINAR', () => {
  it('DEFECTO: la Constitución Federal andaluza servida a Madrid', () => {
    const r = clasificar({
      questionText: '¿Dónde y en qué año se redactó la Constitución Federal andaluza?',
      comunidad: MADRID,
    })
    expect(r.veredicto).toBe('examina_otra')
    expect(r.comunidades).toEqual(['Andalucía'])
  })

  it('DEFECTO: el comité de ética de Castilla-La Mancha servido a Madrid', () => {
    expect(clasificar({
      questionText: 'El comité de ética de salud y bienestar social de castilla-la mancha se configura…',
      comunidad: MADRID,
    }).veredicto).toBe('examina_otra')
  })

  it('DEFECTO: un auxiliar del SESCAM servido a Madrid', () => {
    expect(clasificar({
      questionText: '¿Puede participar un auxiliar de enfermería del SESCAM que tenga la condición de…?',
      comunidad: MADRID,
    }).veredicto).toBe('examina_otra')
  })

  it('CORRECTA: pregunta nacional cuya EXPLICACIÓN cita a Canarias como excepción', () => {
    const r = clasificar({
      questionText: 'Según la Ley General de Sanidad, como regla general, las áreas de salud extenderán su acción a una población de:',
      explanation: 'Con las excepciones de Baleares, Canarias, Ceuta y Melilla, que pueden tener un régimen distinto.',
      comunidad: MADRID,
    })
    expect(r.veredicto).toBe('menciona')
  })

  it('CORRECTA: pregunta nacional cuya explicación nombra Murcia de pasada', () => {
    expect(clasificar({
      questionText: '¿Qué norma regula la igualdad entre hombres y mujeres a nivel nacional?',
      explanation: 'También existe normativa propia en la Región de Murcia.',
      comunidad: MADRID,
    }).veredicto).toBe('menciona')
  })

  it('la comunidad en la OPCIÓN CORRECTA cuenta como examen: es la respuesta que se aprende', () => {
    expect(clasificar({
      questionText: '¿Qué herramienta da acceso a la historia clínica de atención primaria?',
      correcta: 'Abucasis II',
      comunidad: MADRID,
    }).veredicto).toBe('examina_otra')
  })

  it('PROPIA: la pregunta de Madrid servida a Madrid no es defecto', () => {
    expect(clasificar({
      questionText: 'En relación al anteproyecto de presupuesto del Servicio Madrileño de Salud (SERMAS):',
      comunidad: MADRID,
    }).veredicto).toBe('propia')
  })

  it('LIMPIA: sin ninguna comunidad de por medio', () => {
    expect(clasificar({
      questionText: '¿Cuál de las siguientes necesidades básicas no está en el modelo de Virginia Henderson?',
      comunidad: MADRID,
    }).veredicto).toBe('limpia')
  })
})

describe('siglas ambiguas — SMS no decide sola', () => {
  it('SMS es a la vez Servicio Madrileño y Servicio Murciano: manda leerla', () => {
    const r = clasificar({ questionText: 'El anteproyecto de presupuesto del SMS se aprueba por…', comunidad: MADRID })
    expect(r.veredicto).toBe('ambigua')
    expect(r.motivo).toMatch(/Madrid.*Murcia|Murcia.*Madrid/)
  })

  it('ambiguasEn la reconoce y dice entre qué dos opciones duda', () => {
    expect(ambiguasEn('presupuesto del SMS')[0].posibles).toEqual(['Comunidad de Madrid', 'Región de Murcia'])
  })

  it('«sms» en minúscula (un mensaje de móvil) no dispara nada', () => {
    expect(ambiguasEn('recibirás un sms de confirmación')).toEqual([])
  })
})

describe('sin comunidad de referencia declarada', () => {
  it('sin saber qué oposición la sirve, toda comunidad citada en el enunciado es candidata', () => {
    expect(clasificar({ questionText: 'Según la normativa de Andalucía…' }).veredicto).toBe('examina_otra')
  })
})

describe('excepciones de una norma estatal (calibrado contra datos reales)', () => {
  const { esExcepcion } = require('../../../lib/health/preguntaDeOtraComunidad.cjs')

  it('CORRECTA: «con las excepciones de Baleares, Canarias…» es la Ley General de Sanidad, no examen de Canarias', () => {
    const r = clasificar({
      questionText: 'Como regla general y con las excepciones de Baleares, Canarias, Ceuta y Melilla, el área de salud extenderá su acción a una población de:',
      comunidad: MADRID,
    })
    expect(r.veredicto).not.toBe('examina_otra')
  })

  it('«salvo Canarias» tampoco es examen de Canarias', () => {
    expect(esExcepcion('todas las comunidades salvo Canarias aplican', 'Canarias')).toBe(true)
  })

  it('pero una comunidad citada SIN palabra de excepción sigue contando', () => {
    expect(esExcepcion('El comité de ética de Castilla-La Mancha', 'Castilla-La Mancha')).toBe(false)
    expect(clasificar({ questionText: 'El comité de ética de Castilla-La Mancha se configura…', comunidad: MADRID }).veredicto).toBe('examina_otra')
  })

  it('la ventana no alcanza un «excepto» de otra frase lejana', () => {
    const lejos = 'Todos los supuestos son válidos excepto los indicados en el punto anterior. ' +
      'Ahora bien, la normativa aplicable en Andalucía establece que:'
    expect(esExcepcion(lejos, 'Andalucía')).toBe(false)
  })
})
