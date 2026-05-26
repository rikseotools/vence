// __tests__/lib/chat/utils/openai-error-handler.test.ts
//
// Tests del clasificador de errores OpenAI. Caso de origen: 14-15/4/2026
// cuota OpenAI agotada silenciosamente — 72 chats fallaron antes de que un
// usuario lo reportase.

import { classifyOpenAIError, logOpenAIError, __testing } from '@/lib/chat/utils/openai-error-handler'

// Mock del helper validation-error-log que `logOpenAIError` usa desde
// 2026-05-26 (Bloque 4 Fase 1). Antes hacía `db.insert(...)` directo;
// ahora delega en `logValidationErrorAwait` para que el espejo a
// observable_events también se cubra.
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationErrorAwait: jest.fn().mockResolvedValue(undefined),
}))

describe('classifyOpenAIError', () => {
  test('429 quota exceeded (caso Tinokero 15/4) → quota_exceeded + mensaje claro', () => {
    const err = new Error('429 You exceeded your current quota, please check your plan and billing details.')
    ;(err as any).status = 429
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('quota_exceeded')
    expect(c.status).toBe(429)
    expect(c.severity).toBe('critical')
    expect(c.userFacingMessage).toMatch(/temporalmente no disponible|IA.*disponible/i)
    expect(c.userFacingMessage).not.toMatch(/error al verificar/) // no mensaje genérico
  })

  test('429 rate limit (throughput) → rate_limit + severity warning', () => {
    const err = new Error('429 Rate limit reached for tokens per minute')
    ;(err as any).status = 429
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('rate_limit')
    expect(c.severity).toBe('warning')
    expect(c.userFacingMessage).toMatch(/saturad|muchas consultas/i)
  })

  test('429 con mensaje insufficient_quota también mapea a quota_exceeded', () => {
    const err = new Error('insufficient_quota: You have run out of credits')
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('quota_exceeded')
  })

  test('401 invalid API key → auth + critical', () => {
    const err = new Error('Invalid API key provided')
    ;(err as any).status = 401
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('auth')
    expect(c.severity).toBe('critical')
    expect(c.userFacingMessage).toMatch(/configuración|revisándolo/i)
  })

  test('400 context length exceeded → invalid_request + warning', () => {
    const err = new Error("This model's maximum context length is 128000 tokens")
    ;(err as any).status = 400
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('invalid_request')
    expect(c.severity).toBe('warning')
  })

  test('500 server error → server_error + warning', () => {
    const err = new Error('The server had an error while processing your request')
    ;(err as any).status = 500
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('server_error')
    expect(c.severity).toBe('warning')
  })

  test('timeout/abort → timeout', () => {
    const err = new Error('Request timeout after 60s')
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('timeout')
  })

  test('error desconocido → unknown + mensaje genérico (comportamiento antiguo preservado)', () => {
    const err = new Error('Something weird happened')
    const c = classifyOpenAIError(err)
    expect(c.category).toBe('unknown')
    expect(c.severity).toBe('warning')
    expect(c.userFacingMessage).toMatch(/error al verificar/i)
  })

  test('error null/undefined no revienta, devuelve unknown', () => {
    const c1 = classifyOpenAIError(null)
    const c2 = classifyOpenAIError(undefined)
    expect(c1.category).toBe('unknown')
    expect(c2.category).toBe('unknown')
  })

  test('preserva el raw error para forensics posteriores', () => {
    const err = new Error('test')
    const c = classifyOpenAIError(err)
    expect(c.raw).toBe(err)
  })
})

describe('logOpenAIError — rate-limit anti-spam', () => {
  beforeEach(() => {
    __testing.resetCooldown()
    jest.clearAllMocks()
  })

  test('primera llamada: escribe a BD y devuelve true', async () => {
    const classified = classifyOpenAIError(Object.assign(new Error('429 quota'), { status: 429, message: '429 You exceeded your current quota' }))
    const wrote = await logOpenAIError(classified, { endpoint: 'chat/verification' })
    expect(wrote).toBe(true)
  })

  test('segunda llamada inmediata (mismo endpoint+category): NO escribe (cooldown)', async () => {
    const err = Object.assign(new Error('429 You exceeded your current quota'), { status: 429 })
    const c = classifyOpenAIError(err)
    const first = await logOpenAIError(c, { endpoint: 'chat/verification' })
    const second = await logOpenAIError(c, { endpoint: 'chat/verification' })
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  test('distintas categorías no se bloquean entre sí', async () => {
    const quota = classifyOpenAIError(Object.assign(new Error('429 You exceeded your current quota'), { status: 429 }))
    const auth = classifyOpenAIError(Object.assign(new Error('Invalid API key'), { status: 401 }))
    const r1 = await logOpenAIError(quota, { endpoint: 'chat/verification' })
    const r2 = await logOpenAIError(auth, { endpoint: 'chat/verification' })
    expect(r1).toBe(true)
    expect(r2).toBe(true)
  })

  test('distintos endpoints no se bloquean entre sí', async () => {
    const c = classifyOpenAIError(Object.assign(new Error('429 You exceeded your current quota'), { status: 429 }))
    const r1 = await logOpenAIError(c, { endpoint: 'chat/verification' })
    const r2 = await logOpenAIError(c, { endpoint: 'chat/search' })
    expect(r1).toBe(true)
    expect(r2).toBe(true)
  })

  test('si el logger interno lanza (contrato roto), no propaga excepción y devuelve false', async () => {
    // logValidationErrorAwait NO debería lanzar nunca por contrato (try/catch
    // interno). Este test verifica el catch defensivo de `logOpenAIError` por
    // si alguien rompiera ese contrato en el futuro.
    const { logValidationErrorAwait } = jest.requireMock('@/lib/api/validation-error-log')
    logValidationErrorAwait.mockRejectedValueOnce(new Error('contract broken'))
    const c = classifyOpenAIError(new Error('429 quota'))
    await expect(logOpenAIError(c, { endpoint: 'chat/verification' })).resolves.toBe(false)
  })
})
