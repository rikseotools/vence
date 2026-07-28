/**
 * @jest-environment node
 */
// Respuestas de error del chat: clasificación y reconocimiento. Puras.
//
// Nacen de un fallo medido el 28/07/2026: el chat sirvió **210 respuestas de error a
// usuarios** y `ai_chat_logs.had_error` estaba en `false` en las 210. El campo existía y
// `insertChatLog` lo aceptaba; simplemente nadie se lo pasaba. Resultado: semanas de fallos
// invisibles para las alertas, destapados solo porque 27 usuarios pulsaron el pulgar abajo.
//
// Lo que se fija aquí es lo que impide que vuelva a pasar en silencio: que el mismo módulo
// que COMPONE el mensaje sea el que lo RECONOCE, para que no puedan divergir.

import {
  clasificarErrorProveedor,
  mensajeDeError,
  esRespuestaDeError,
  MENSAJES,
} from '@/lib/chat/shared/errorResponses'

describe('clasificarErrorProveedor', () => {
  it('reconoce la falta de saldo aunque venga como 400', () => {
    // Anthropic manda "credit balance is too low" con status 400 (invalid_request_error), no
    // con un 402. Mirar solo el status lo confundiría con un error de programación nuestro —
    // y es la causa REAL de 27 fallos entre mayo y julio.
    expect(
      clasificarErrorProveedor(400, '400 {"type":"error","error":{"message":"Your credit balance is too low"}}'),
    ).toBe('sin_saldo')
  })

  it('reconoce otras formas de decir lo mismo', () => {
    expect(clasificarErrorProveedor(429, 'insufficient_quota')).toBe('sin_saldo')
    expect(clasificarErrorProveedor(400, 'billing hard limit reached')).toBe('sin_saldo')
  })

  it('la falta de saldo MANDA sobre el status de saturación', () => {
    // Un 429 por cuota agotada no es "espera unos minutos": esperar no lo arregla.
    expect(clasificarErrorProveedor(429, 'You exceeded your current quota: insufficient_quota')).toBe('sin_saldo')
  })

  it('distingue la saturación real', () => {
    for (const s of [429, 503, 529]) {
      expect(clasificarErrorProveedor(s, 'Overloaded')).toBe('saturado')
    }
  })

  it('lo demás es genérico, incluido un 404 de modelo inexistente', () => {
    // El 404 de `claude-sonnet-4-20250514` causó 179 fallos entre el 15/06 y el 09/07. Al
    // usuario no se le puede explicar eso, pero SÍ tiene que quedar marcado como error.
    expect(clasificarErrorProveedor(404, 'not_found_error: model claude-sonnet-4-20250514')).toBe('generico')
    expect(clasificarErrorProveedor(500, 'boom')).toBe('generico')
    expect(clasificarErrorProveedor(undefined, undefined)).toBe('generico')
  })
})

describe('mensajeDeError — lo que se le dice al usuario', () => {
  it('con la cuenta sin saldo NO se le pide que reintente', () => {
    // Era lo que hacíamos: "vuelve a intentarlo en unos minutos" con la cuenta sin saldo es
    // pedirle que insista en algo que no puede salir bien.
    const m = mensajeDeError('sin_saldo')
    expect(m).not.toMatch(/vuelve a intentarlo|int[eé]ntalo de nuevo|espera unos minutos/i)
    // Y se le dice que no es culpa suya, y qué SÍ puede hacer mientras tanto.
    expect(m).toMatch(/no es cosa tuya/i)
    expect(m).toMatch(/tests y el temario/i)
  })

  it('con saturación SÍ se le pide que espere (ahí reintentar sirve)', () => {
    expect(mensajeDeError('saturado')).toMatch(/espera unos minutos/i)
  })

  it('ningún mensaje culpa al usuario ni le manda a soporte a ciegas', () => {
    for (const m of Object.values(MENSAJES)) {
      expect(m).not.toMatch(/tu conexi[oó]n est[aá] mal|has hecho algo/i)
      expect(m.length).toBeGreaterThan(40)
    }
  })
})

describe('esRespuestaDeError — lo que decide si se marca `had_error`', () => {
  it('reconoce los mensajes que produce este mismo módulo', () => {
    // Que produzca y reconozca el mismo sitio es la razón de que exista: con los textos
    // escritos a mano en cinco ficheros, cambiar una coma rompía el detector en silencio.
    for (const m of Object.values(MENSAJES)) {
      expect(esRespuestaDeError(m)).toBe(true)
    }
  })

  it('reconoce los textos ANTIGUOS, escritos a mano antes de este módulo', () => {
    // Mientras queden desplegados o se consulten logs viejos, hay que seguir viéndolos.
    const viejos = [
      '⚠️ **Ha ocurrido un error generando la explicación.**\n\nPor favor, vuelve a intentarlo en unos minutos.',
      'Hubo un error al procesar tu consulta. Por favor, intenta de nuevo.',
      'Hubo un error al procesar tu consulta sobre el temario. Por favor, intenta de nuevo.',
      '⚠️ **Nuestro sistema de razonamiento avanzado está saturado en este momento.**',
    ]
    for (const v of viejos) expect(esRespuestaDeError(v)).toBe(true)
  })

  it('NO marca como error una respuesta normal', () => {
    // Falsos positivos aquí serían peores que el problema: inflarían las alertas y acabarían
    // haciendo que se ignoren.
    const buenas = [
      '✅ **La respuesta correcta es la C.** Según el artículo 20 de la Ley 39/2015…',
      'El plazo de interposición del recurso de alzada es de un mes.',
      'Para resolver este cálculo, primero divide 2.100 entre 8…',
      // Una respuesta que HABLA de errores sin serlo.
      'Un error frecuente en este artículo es confundir el plazo de un mes con el de tres meses.',
      'La Ley 39/2015 regula la subsanación de errores materiales en su artículo 109.2.',
    ]
    for (const b of buenas) expect(esRespuestaDeError(b)).toBe(false)
  })

  it('tolera vacío y nulo', () => {
    expect(esRespuestaDeError(null)).toBe(false)
    expect(esRespuestaDeError(undefined)).toBe(false)
    expect(esRespuestaDeError('')).toBe(false)
  })

  it('mira solo el principio: una respuesta larga que cite un error al final no cuenta', () => {
    const larga = 'La respuesta correcta es la B. ' + 'texto legítimo. '.repeat(60) + 'Ha ocurrido un error generando la explicación.'
    expect(esRespuestaDeError(larga)).toBe(false)
  })
})
