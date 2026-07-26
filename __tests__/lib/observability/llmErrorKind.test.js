const { clasificarErrorLlm, requiereIntervencion, CLASES } = require('@/lib/observability/llmErrorKind.cjs')

// Mensaje REAL capturado en producción el 26/07/2026, cuando el radar llevaba 8 horas muerto.
// Es el caso que motiva el módulo: llega como 400 (no 402, no 429) y por eso parecía un error de
// petición. Si este test se cae, el diagnóstico vuelve a ser "algo falla".
const SIN_SALDO_ANTHROPIC =
  '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is ' +
  'too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'

describe('clasificarErrorLlm — lo que de verdad hay que hacer con el fallo', () => {
  it('CAZA el caso real: falta de saldo, aunque venga como 400 invalid_request_error', () => {
    const r = clasificarErrorLlm(SIN_SALDO_ANTHROPIC, 400)
    expect(r.kind).toBe('sin_credito')
    expect(r.accion).toMatch(/recarga saldo/i)
  })

  it('distingue sin saldo de clave revocada, que es el error que costó el diagnóstico', () => {
    const auth = clasificarErrorLlm('{"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}', 401)
    expect(auth.kind).toBe('auth_invalida')
    expect(clasificarErrorLlm(SIN_SALDO_ANTHROPIC, 400).kind).not.toBe(auth.kind)
  })

  it('entiende también la forma de OpenAI para la misma causa', () => {
    expect(clasificarErrorLlm('You exceeded your current quota, please check your plan and billing details', 429).kind).toBe('sin_credito')
    expect(clasificarErrorLlm('insufficient_quota', 429).kind).toBe('sin_credito')
  })

  it('el TEXTO manda sobre el código: un 429 por cuota no es un rate limit', () => {
    // Confundirlos manda a esperar cuando lo que hace falta es pagar.
    expect(clasificarErrorLlm('insufficient_quota', 429).kind).toBe('sin_credito')
    expect(clasificarErrorLlm('Rate limit reached for requests', 429).kind).toBe('rate_limit')
  })

  it('modelo retirado, permiso, sobrecarga y timeout', () => {
    expect(clasificarErrorLlm('model claude-x-1 does not exist', 404).kind).toBe('modelo_no_disponible')
    expect(clasificarErrorLlm('permission_error: does not have access to model', 403).kind).toBe('permiso')
    expect(clasificarErrorLlm('Overloaded', 529).kind).toBe('sobrecarga')
    expect(clasificarErrorLlm('fetch failed: ETIMEDOUT').kind).toBe('timeout')
  })

  it('cae al código HTTP solo cuando el mensaje no dice nada', () => {
    expect(clasificarErrorLlm('', 401).kind).toBe('auth_invalida')
    expect(clasificarErrorLlm('algo raro', 503).kind).toBe('sobrecarga')
  })

  it('NUNCA inventa: sin mensaje ni código reconocible, lo dice', () => {
    expect(clasificarErrorLlm(null).kind).toBe('desconocido')
    expect(clasificarErrorLlm('boom', 418).kind).toBe('otro')
    expect(clasificarErrorLlm('boom', 418).accion).toMatch(/error_message/)
  })

  it('separa lo que exige una persona de lo que se arregla reintentando', () => {
    for (const k of ['sin_credito', 'auth_invalida', 'permiso', 'modelo_no_disponible']) {
      expect(requiereIntervencion(k)).toBe(true)
    }
    for (const k of ['rate_limit', 'sobrecarga', 'timeout', 'otro', 'desconocido']) {
      expect(requiereIntervencion(k)).toBe(false)
    }
  })

  it('toda clase declara su acción (una clase sin acción no ayuda a nadie)', () => {
    for (const c of CLASES) {
      expect(c.accion.trim().length).toBeGreaterThan(20)
    }
  })
})
