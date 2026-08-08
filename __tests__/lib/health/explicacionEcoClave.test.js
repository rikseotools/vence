'use strict'

const {
  esEco,
  numerosPegados,
  verbosPegados,
  esVerboInfinitivo,
  clasificaPregunta,
} = require('@/lib/health/explicacionEcoClave.cjs')

describe('esEco', () => {
  test('caso real 357cd03d: explicación = opción correcta, sin razonamiento propio', () => {
    const opcion =
      'Respetar los derechos económicos, sociales y culturales para las mujeres víctimas de violencia de género, con el fin de facilitar su integración social.'
    const explicacion =
      'Se solicita marcar la INCORRECTA: Respetar Garantizar los derechos económicos, sociales y culturales para las mujeres víctimas de violencia de género, con el fin de facilitar su integración social. Artículo 2.e de la presente Ley Orgánica.'
    expect(esEco({ explanation: explicacion, opcionTexto: opcion })).toBe(true)
  })

  test('caso real eac20b04: explicación = opción correcta (option_d) con número duplicado', () => {
    const opcion =
      'Que el Tribunal de Instancia, en el plazo de 12 horas contadas desde que se dictó el auto de incoación, debe proceder a dictar la resolución que proceda.'
    const explicacion =
      'Que el Tribunal de Instancia*, en el plazo de 12 horas 24 horas contadas desde que se dictó el auto de incoación, debe proceder a dictar la resolución que proceda.'
    expect(esEco({ explanation: explicacion, opcionTexto: opcion })).toBe(true)
  })

  test('una explicación de verdad (añade razonamiento, cita el artículo, distingue opciones) NO es eco', () => {
    const opcion = 'C) ES LA INCORRECTA'
    const explicacion =
      'La respuesta correcta es la **C**.\n\nLas cuatro afirmaciones reproducen fines del artículo 2, y tres lo hacen palabra por palabra. La falsa no niega un derecho que la ley reconozca: le cambia la FINALIDAD, que es donde está la trampa.\n\n> **Artículo 2, letra e), de la Ley Orgánica 1/2004**\n> "Garantizar derechos económicos para las mujeres víctimas de violencia de género, con el fin de facilitar su integración social."\n\n**A)** VERDADERA — Es la letra k) del artículo 2, literal.'
    expect(esEco({ explanation: explicacion, opcionTexto: opcion })).toBe(false)
  })

  test('explicación corta pero que SÍ razona (no solo repite la opción) no es eco', () => {
    const opcion = 'Veinticinco años.'
    const explicacion =
      'Es incorrecto porque el artículo 12 fija el plazo en treinta años, no en veinticinco, para este supuesto concreto de prescripción.'
    expect(esEco({ explanation: explicacion, opcionTexto: opcion })).toBe(false)
  })

  test('sin opción o sin explicación no revienta', () => {
    expect(esEco({ explanation: null, opcionTexto: 'algo' })).toBe(false)
    expect(esEco({ explanation: 'algo', opcionTexto: null })).toBe(false)
    expect(esEco({})).toBe(false)
  })
})

describe('numerosPegados', () => {
  test('caso real: "un tercio a la mitad"', () => {
    expect(numerosPegados('se reducirán en un tercio a la mitad los plazos establecidos')).toEqual(
      expect.arrayContaining([expect.stringContaining('tercio a la mitad')]),
    )
  })

  test('caso real: "seis tres meses"', () => {
    expect(numerosPegados('Podrán realizarse en los seis tres meses siguientes a la fecha')).toHaveLength(1)
  })

  test('caso real: "ocho cuatro años"', () => {
    expect(numerosPegados('caducarán transcurridos ocho cuatro años desde que el legitimado')).toHaveLength(1)
  })

  test('NO marca una cita de artículo con número de párrafo pegado ("Art. 17.2 2.")', () => {
    expect(numerosPegados('Del art. 17.2 2. Los Estados miembros velarán por que')).toEqual([])
  })

  test('NO marca "Artículo 50\\n5." (número de artículo + número de párrafo en líneas distintas)', () => {
    expect(numerosPegados('Artículo 50\n5. Si el Estado miembro que se ha retirado')).toEqual([])
  })

  test('NO marca una fecha ("Ley 9/2014 de 9 de mayo")', () => {
    expect(numerosPegados('se conceden en la Ley 9/2014 de 9 de mayo en cuanto a servicios')).toEqual([])
  })

  test('NO marca un solo número con artículo indefinido delante ("en un 1,9 % cada año")', () => {
    expect(numerosPegados('se reduzca al menos en un 1,9 % cada año, en comparación')).toEqual([])
  })

  test('mismo número repetido no cuenta como pegado (no hay dos candidatos distintos)', () => {
    expect(numerosPegados('el plazo de cinco cinco años')).toEqual([])
  })

  test('texto sin números no revienta', () => {
    expect(numerosPegados('ninguna cifra por aquí')).toEqual([])
    expect(numerosPegados(null)).toEqual([])
  })
})

describe('esVerboInfinitivo', () => {
  test('infinitivos reales', () => {
    expect(esVerboInfinitivo('garantizar')).toBe(true)
    expect(esVerboInfinitivo('respetar')).toBe(true)
    expect(esVerboInfinitivo('facilitar')).toBe(true)
    expect(esVerboInfinitivo('recibir')).toBe(true)
  })

  test('palabras que acaban en -ar/-er/-ir SIN ser infinitivos (la exclusión que sostiene la precisión)', () => {
    expect(esVerboInfinitivo('carácter')).toBe(false)
    expect(esVerboInfinitivo('cualquier')).toBe(false)
    expect(esVerboInfinitivo('particular')).toBe(false)
    expect(esVerboInfinitivo('tercer')).toBe(false)
    expect(esVerboInfinitivo('militar')).toBe(false)
  })

  test('palabras cortas no cuentan (ruido)', () => {
    expect(esVerboInfinitivo('ir')).toBe(false)
    expect(esVerboInfinitivo('ser')).toBe(false)
  })
})

describe('verbosPegados', () => {
  test('caso real, el que motiva la ficha: "Respetar Garantizar"', () => {
    const hits = verbosPegados(
      'Se solicita marcar la INCORRECTA: Respetar Garantizar los derechos económicos, sociales y culturales',
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].toLowerCase()).toContain('respetar')
    expect(hits[0].toLowerCase()).toContain('garantizar')
  })

  test('caso real: "coordinar elevar"', () => {
    expect(verbosPegados('dirigidas a la promoción de la mejora para coordinar elevar el nivel de protección')).toHaveLength(1)
  })

  test('caso real: "eliminar limitar"', () => {
    expect(verbosPegados('con miras a eliminar limitar el empleo de la fuerza')).toHaveLength(1)
  })

  test('NO marca un verbo de control que rige gramaticalmente el segundo infinitivo ("podrá acordar continuar con")', () => {
    expect(verbosPegados('el órgano competente podrá acordar continuar con la tramitación ordinaria')).toEqual([])
  })

  test('NO marca dos infinitivos separados por "y" (enumeración legítima)', () => {
    expect(verbosPegados('el deber de respetar y garantizar los derechos fundamentales')).toEqual([])
  })

  test('NO marca dos infinitivos separados por coma', () => {
    expect(verbosPegados('deberá notificar, comunicar la resolución al interesado')).toEqual([])
  })

  test('NO marca falsos verbos por sufijo ("de carácter militar")', () => {
    expect(verbosPegados('las misiones de carácter militar que se le encomienden')).toEqual([])
  })

  test('texto sin verbos pegados no revienta', () => {
    expect(verbosPegados('ninguna palabra por aquí termina así')).toEqual([])
    expect(verbosPegados(null)).toEqual([])
  })
})

describe('clasificaPregunta', () => {
  test('caso real completo eac20b04: eco Y contaminado (número pegado)', () => {
    const q = {
      correct_option: 3,
      option_a:
        'La articulación de un procedimiento que permita, sin complicaciones innecesarias, el acceso a la Autoridad Judicial.',
      option_b:
        'La articulación de un procedimiento lo suficientemente rápido como para conseguir la inmediata verificación judicial de la legalidad y de las condiciones de la detención.',
      option_c:
        'La articulación de un procedimiento lo suficientemente sencillo como para que sea accesible a todos los ciudadanos.',
      option_d:
        'Que el Tribunal de Instancia, en el plazo de 12 horas contadas desde que se dictó el auto de incoación, debe proceder a dictar la resolución que proceda.',
      explanation:
        'Que el Tribunal de Instancia*, en el plazo de 12 horas 24 horas contadas desde que se dictó el auto de incoación, debe proceder a dictar la resolución que proceda.',
    }
    const r = clasificaPregunta(q)
    expect(r.eco).toBe(true)
    expect(r.contaminado).toBe(true)
    expect(r.numeros.length).toBeGreaterThan(0)
  })

  test('caso real completo 357cd03d: eco Y contaminado (verbo pegado)', () => {
    const q = {
      correct_option: 0,
      option_a:
        'Respetar los derechos económicos, sociales y culturales para las mujeres víctimas de violencia de género, con el fin de facilitar su integración social.',
      option_b: 'Otra opción cualquiera que no viene al caso aquí.',
      option_c: 'Otra opción distinta más.',
      option_d: 'Y una cuarta opción.',
      explanation:
        'Se solicita marcar la INCORRECTA: Respetar Garantizar los derechos económicos, sociales y culturales para las mujeres víctimas de violencia de género, con el fin de facilitar su integración social. Artículo 2.e de la presente Ley Orgánica.',
    }
    const r = clasificaPregunta(q)
    expect(r.eco).toBe(true)
    expect(r.contaminado).toBe(true)
    expect(r.verbos.length).toBeGreaterThan(0)
  })

  test('eco SIN contaminar: repite la opción pero no trae dos candidatos pegados', () => {
    const q = {
      correct_option: 0,
      option_a: 'El régimen económico estará sometido a los principios de transparencia y publicidad.',
      option_b: 'Otra cosa.',
      option_c: 'Otra cosa más.',
      option_d: 'Y otra.',
      explanation: 'El régimen económico estará sometido a los principios de: Transparencia. Publicidad.',
    }
    const r = clasificaPregunta(q)
    expect(r.eco).toBe(true)
    expect(r.contaminado).toBe(false)
  })

  test('explicación de verdad: ni eco ni contaminado', () => {
    const q = {
      correct_option: 2,
      option_a: 'Verdadera.',
      option_b: 'Verdadera también.',
      option_c: 'ES LA INCORRECTA',
      option_d: 'Verdadera.',
      explanation:
        'La respuesta correcta es la C. El artículo dice que el fin es facilitar la integración social, no mejorar la posición social como afirma la opción — es un cambio de finalidad, no de derecho reconocido.',
    }
    const r = clasificaPregunta(q)
    expect(r.eco).toBe(false)
    expect(r.contaminado).toBe(false)
  })
})
