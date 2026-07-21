/**
 * Tests de lib/exam/answerSaveRetry — decisiones puras del guardado de examen.
 * Ancla la lógica de reintento/aviso del fix caso Marta (21/07/2026).
 */
import {
  classifyAnswerSaveResponse,
  answerSaveBackoffMs,
  shouldEmitSaveDegraded,
} from '@/lib/exam/answerSaveRetry'

describe('classifyAnswerSaveResponse', () => {
  it('200 con success=true → ok', () => {
    expect(classifyAnswerSaveResponse(200, true, true, false)).toBe('ok')
  })

  it('403 con deviceLimitReached → device_limit (no reintentar)', () => {
    expect(classifyAnswerSaveResponse(403, false, false, true)).toBe('device_limit')
  })

  it('403 SIN deviceLimitReached → permanent (permiso, no reintentar)', () => {
    expect(classifyAnswerSaveResponse(403, false, false, false)).toBe('permanent')
  })

  it('400 (input inválido) → permanent', () => {
    expect(classifyAnswerSaveResponse(400, false, false, false)).toBe('permanent')
  })

  it('422 (correctAnswer requerido) → permanent, NO se reintenta', () => {
    expect(classifyAnswerSaveResponse(422, false, false, false)).toBe('permanent')
  })

  it('429 (rate limit) → retriable', () => {
    expect(classifyAnswerSaveResponse(429, false, false, false)).toBe('retriable')
  })

  it('500 → retriable', () => {
    expect(classifyAnswerSaveResponse(500, false, false, false)).toBe('retriable')
  })

  it('503 (saturado) → retriable', () => {
    expect(classifyAnswerSaveResponse(503, false, false, false)).toBe('retriable')
  })

  it('504 (timeout gateway) → retriable', () => {
    expect(classifyAnswerSaveResponse(504, false, false, false)).toBe('retriable')
  })

  it('200 pero success=false (fallo interno silencioso) → retriable', () => {
    expect(classifyAnswerSaveResponse(200, true, false, false)).toBe('retriable')
  })
})

describe('answerSaveBackoffMs', () => {
  it('backoff lineal 1s, 2s, 3s', () => {
    expect(answerSaveBackoffMs(1)).toBe(1000)
    expect(answerSaveBackoffMs(2)).toBe(2000)
    expect(answerSaveBackoffMs(3)).toBe(3000)
  })
})

describe('shouldEmitSaveDegraded', () => {
  it('no avisa por debajo del umbral', () => {
    expect(shouldEmitSaveDegraded(1, false)).toBe(false)
    expect(shouldEmitSaveDegraded(2, false)).toBe(false)
  })

  it('avisa al alcanzar el umbral (3) si no se emitió aún', () => {
    expect(shouldEmitSaveDegraded(3, false)).toBe(true)
  })

  it('NO reemite si ya se emitió esta sesión (1 evento por sesión)', () => {
    expect(shouldEmitSaveDegraded(3, true)).toBe(false)
    expect(shouldEmitSaveDegraded(10, true)).toBe(false)
  })

  it('respeta un umbral custom', () => {
    expect(shouldEmitSaveDegraded(2, false, 2)).toBe(true)
    expect(shouldEmitSaveDegraded(1, false, 2)).toBe(false)
  })
})
