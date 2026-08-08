const {
  esVeredictoInequivoco,
  clasificarVeredicto,
  PATRON_ETIQUETA,
  PATRON_NO_RESPONDE,
  PATRON_OTRA_PREGUNTA,
} = require('../../../lib/health/veredictoRojoInequivoco.cjs')

describe('esVeredictoInequivoco (T-405: el caso Estela — 12 días sirviéndose sin que nadie lo viera)', () => {
  it('EL CASO REAL: el texto literal de la verificación del 19/07 se reconoce', () => {
    const texto =
      'OPCIONES CORRUPTAS: enunciado y explicacion sobre legalizacion/apostilla (art13.1) ' +
      'pero las 4 opciones hablan de recursos; opcion A marcada no responde a la pregunta'
    expect(esVeredictoInequivoco(texto)).toBe(true)
  })

  it('reconoce la etiqueta sola, sin el resto del texto', () => {
    expect(esVeredictoInequivoco('Opciones corruptas.')).toBe(true)
  })

  it('reconoce "la opción marcada no responde a la pregunta" sin la etiqueta', () => {
    expect(esVeredictoInequivoco('La opción C marcada no responde en absoluto a la pregunta planteada.')).toBe(true)
  })

  it('reconoce "las opciones son de otra pregunta"', () => {
    expect(esVeredictoInequivoco('Las opciones presentadas son de otra pregunta del mismo lote.')).toBe(true)
  })

  it('NO marca una nota de auditoría ciega genérica (el pool de los 400, mayormente ruido)', () => {
    expect(esVeredictoInequivoco('La opción B podría matizarse mejor, revisar redacción.')).toBe(false)
  })

  it('NO marca un simple "options_ok=false" sin razonamiento (nota corta de blind audit)', () => {
    expect(esVeredictoInequivoco('Posible discrepancia en la opción D, no confirmado.')).toBe(false)
  })

  // Calibración 08/08/2026: corrida la query real contra los 223.064 registros de
  // ai_verification_results (VENCE_LECTOR_URL, tras arreglarse el RLS-sin-política que bloqueaba
  // al rol de la flota). Sobre el histórico completo, la versión anterior de PATRON_NO_RESPONDE
  // enganchaba estas 5 filas ADEMÁS de la de Estela — las 5 eran notas normales de verificación
  // (explican por qué una opción no es la mejor respuesta), no el defecto estructural que este
  // patrón existe para cazar. Paráfrasis de las 5, sin copiar contenido real de BD.
  describe('NO marca notas normales de verificación con fraseo parecido a "no responde" (calibración 08/08)', () => {
    it('con adverbio de matiz "adecuadamente"', () => {
      expect(esVeredictoInequivoco('Esta opción no responde adecuadamente a la pregunta específica.')).toBe(false)
    })
    it('con adverbio de matiz "lógicamente"', () => {
      expect(esVeredictoInequivoco('Proporciona una definición, pero no responde lógicamente a la pregunta.')).toBe(false)
    })
    it('hablando del "contenido principal", no de la opción marcada', () => {
      expect(esVeredictoInequivoco('Esta opción no responde al contenido principal de la pregunta.')).toBe(false)
    })
    it('describiendo una redacción confusa, sin decir que es LA MARCADA', () => {
      expect(esVeredictoInequivoco('Es una redacción confusa que no responde adecuadamente a la pregunta.')).toBe(false)
    })
    it('respuesta parcial ("solo una parte"), sin la palabra "marcada"', () => {
      expect(esVeredictoInequivoco('Esta opción es solo una parte del régimen, no responde a la pregunta sobre la duración total.')).toBe(false)
    })
  })

  it('es total: no revienta con null/undefined/vacío', () => {
    expect(esVeredictoInequivoco(null)).toBe(false)
    expect(esVeredictoInequivoco(undefined)).toBe(false)
    expect(esVeredictoInequivoco('')).toBe(false)
  })

  it('case-insensitive: MAYÚSCULAS y minúsculas tratadas igual', () => {
    expect(esVeredictoInequivoco('OPCIONES CORRUPTAS')).toBe(true)
    expect(esVeredictoInequivoco('opciones corruptas')).toBe(true)
  })
})

describe('clasificarVeredicto (la fila completa, con sus tres flags)', () => {
  it('ningún flag en false → null (no debería haber llegado aquí, pero es total)', () => {
    expect(clasificarVeredicto({ options_ok: true, answer_ok: true, enunciado_ok: true })).toBeNull()
    expect(clasificarVeredicto({})).toBeNull()
  })

  it('options_ok=false + texto inequívoco → error', () => {
    expect(
      clasificarVeredicto({ options_ok: false, explanation: 'OPCIONES CORRUPTAS: no corresponden' }),
    ).toBe('error')
  })

  it('options_ok=false + texto opinable (el caso común, 400 activas) → warn', () => {
    expect(
      clasificarVeredicto({ options_ok: false, explanation: 'La opción B es discutible, revisar.' }),
    ).toBe('warn')
  })

  it('answer_ok=false por sí solo, sin texto → warn (no hay marcador inequívoco que agarrar)', () => {
    expect(clasificarVeredicto({ answer_ok: false, explanation: null })).toBe('warn')
  })

  it('enunciado_ok=false con marcador inequívoco → error', () => {
    expect(
      clasificarVeredicto({ enunciado_ok: false, explanation: 'la opción marcada no responde a la pregunta' }),
    ).toBe('error')
  })
})

describe('los tres patrones son necesarios (ninguno es redundante)', () => {
  it('PATRON_ETIQUETA no reconoce el fraseo de "no responde"', () => {
    expect(PATRON_ETIQUETA.test('la opción marcada no responde a la pregunta')).toBe(false)
  })
  it('PATRON_NO_RESPONDE no reconoce la etiqueta sola', () => {
    expect(PATRON_NO_RESPONDE.test('opciones corruptas')).toBe(false)
  })
  it('PATRON_OTRA_PREGUNTA no reconoce ninguno de los otros dos', () => {
    expect(PATRON_OTRA_PREGUNTA.test('opciones corruptas')).toBe(false)
    expect(PATRON_OTRA_PREGUNTA.test('la opción marcada no responde a la pregunta')).toBe(false)
  })
})
