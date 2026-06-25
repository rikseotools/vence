// __tests__/lib/tts/telemetry.test.ts
//
// Tests de la capa de telemetría TTS. Mockea emitClientEvent para verificar
// que cada helper emite el eventType correcto, la severity adecuada y la
// metadata enriquecida con browser context.

/**
 * @jest-environment jsdom
 */

import { emitClientEvent } from '@/lib/observability/client'
import {
  getBrowserContext,
  newSessionId,
  ttsTelemetry,
} from '@/lib/tts/telemetry'

jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: jest.fn(),
}))

const mockEmit = emitClientEvent as jest.MockedFunction<typeof emitClientEvent>

describe('newSessionId', () => {
  it('devuelve string único cada llamada', () => {
    const a = newSessionId()
    const b = newSessionId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(8)
  })
})

describe('getBrowserContext', () => {
  it('detecta browser y mobile desde userAgent', () => {
    const ctx = getBrowserContext()
    expect(ctx).toHaveProperty('browser')
    expect(ctx).toHaveProperty('isMobile')
    expect(ctx).toHaveProperty('userAgent')
    expect(typeof ctx.isMobile).toBe('boolean')
  })

  it('cachea el resultado (mismo objeto entre llamadas)', () => {
    const a = getBrowserContext()
    const b = getBrowserContext()
    expect(a).toBe(b)
  })
})

describe('ttsTelemetry', () => {
  beforeEach(() => {
    mockEmit.mockReset()
  })

  it('sessionStart emite tts_session_start con severity info + metadata completa', () => {
    ttsTelemetry.sessionStart({
      sessionId: 'sess-1',
      lawName: 'CE',
      articleNumber: '1',
      chunksTotal: 10,
      textLen: 1500,
      voiceURI: 'google-es',
      voiceName: 'Google Español',
      rate: 1.5,
    })
    expect(mockEmit).toHaveBeenCalledTimes(1)
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('info')
    expect(call.eventType).toBe('tts_session_start')
    expect(call.metadata).toMatchObject({
      sessionId: 'sess-1',
      lawName: 'CE',
      chunksTotal: 10,
      voiceURI: 'google-es',
      rate: 1.5,
    })
    // browser/isMobile enriquecidos
    expect(call.metadata).toHaveProperty('browser')
    expect(call.metadata).toHaveProperty('isMobile')
  })

  it('sessionEnd con endReason=natural → info', () => {
    ttsTelemetry.sessionEnd({
      sessionId: 'sess-1',
      endReason: 'natural',
      durationMs: 30_000,
      chunksCompleted: 10,
      chunksTotal: 10,
      chunksSkipped: 0,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('info')
    expect(call.eventType).toBe('tts_session_end')
    expect(call.durationMs).toBe(30_000)
    expect(call.metadata?.endReason).toBe('natural')
  })

  it('sessionEnd con endReason=error → warn', () => {
    ttsTelemetry.sessionEnd({
      sessionId: 'sess-1',
      endReason: 'error',
      durationMs: 100,
      chunksCompleted: 0,
      chunksTotal: 5,
      chunksSkipped: 0,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
  })

  it('chunkSkip emite warn con descripción del motivo', () => {
    ttsTelemetry.chunkSkip({
      sessionId: 'sess-1',
      chunkIdx: 5,
      chunksTotal: 20,
      reason: 'zombie',
      retriesAttempted: 3,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
    expect(call.eventType).toBe('tts_chunk_skip')
    expect(call.errorMessage).toMatch(/zombie/)
    expect(call.errorMessage).toMatch(/5\/20/)
    expect(call.metadata?.reason).toBe('zombie')
    expect(call.metadata?.retriesAttempted).toBe(3)
  })

  it('watchdogRetry usa severity debug (alto volumen)', () => {
    ttsTelemetry.watchdogRetry({
      sessionId: 'sess-1',
      chunkIdx: 3,
      retryNum: 1,
      reason: 'dead',
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('debug')
    expect(call.eventType).toBe('tts_watchdog_retry')
  })

  it('noVoices emite warn con conteos', () => {
    ttsTelemetry.noVoices({
      totalVoices: 10,
      spanishVoices: 0,
      voicesLoaded: true,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
    expect(call.eventType).toBe('tts_no_voices')
    expect(call.metadata?.totalVoices).toBe(10)
    expect(call.metadata?.spanishVoices).toBe(0)
  })

  it('voicesLoadTimeout emite warn con tiempo esperado', () => {
    ttsTelemetry.voicesLoadTimeout({ waitedMs: 3000 })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
    expect(call.eventType).toBe('tts_voices_load_timeout')
    expect(call.metadata?.waitedMs).toBe(3000)
  })

  it('chainAdvance emite info correlando from y to', () => {
    ttsTelemetry.chainAdvance({
      fromSessionId: 'sess-A',
      fromLaw: 'LO 3/1983',
      toLaw: 'Reglamento Asamblea',
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('info')
    expect(call.eventType).toBe('tts_chain_advance')
    expect(call.metadata?.fromSessionId).toBe('sess-A')
  })

  it('error emite warn severity con tipo y mensaje', () => {
    // Recalibración 25/06: severity 'warn' (no 'error'). El caso dominante es
    // synthesis-failed en Chrome móvil al backgroundear — limitación esperada del
    // navegador, no un bug de la app (el engine además agrega a 1 por sesión).
    ttsTelemetry.error({
      sessionId: 'sess-1',
      atChunkIdx: 7,
      errorType: 'synthesis-failed',
      message: 'Custom message',
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
    expect(call.eventType).toBe('tts_error')
    expect(call.errorMessage).toBe('Custom message')
    expect(call.metadata?.errorType).toBe('synthesis-failed')
  })

  it('unsupported emite warn sin sessionId', () => {
    ttsTelemetry.unsupported()
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('warn')
    expect(call.eventType).toBe('tts_unsupported')
  })

  it('userAction registra cambios de pause/resume/rate_change/voice_change', () => {
    ttsTelemetry.userAction({
      sessionId: 'sess-1',
      action: 'rate_change',
      atChunkIdx: 4,
      fromValue: 1.0,
      toValue: 1.5,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('debug')
    expect(call.eventType).toBe('tts_user_action')
    expect(call.metadata?.action).toBe('rate_change')
    expect(call.metadata?.fromValue).toBe(1.0)
    expect(call.metadata?.toValue).toBe(1.5)
  })

  it('seek emite info con método y from/to (chunk + section)', () => {
    ttsTelemetry.seek({
      sessionId: 'sess-1',
      method: 'next_section',
      fromChunkIdx: 2,
      toChunkIdx: 5,
      fromSectionIdx: 0,
      toSectionIdx: 1,
    })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severity).toBe('info')
    expect(call.eventType).toBe('tts_seek')
    expect(call.metadata?.method).toBe('next_section')
    expect(call.metadata?.fromChunkIdx).toBe(2)
    expect(call.metadata?.toChunkIdx).toBe(5)
    expect(call.metadata?.fromSectionIdx).toBe(0)
    expect(call.metadata?.toSectionIdx).toBe(1)
  })

  it('todos los eventos incluyen browser e isMobile en metadata', () => {
    ttsTelemetry.unsupported()
    ttsTelemetry.chunkSkip({
      sessionId: 's',
      chunkIdx: 0,
      chunksTotal: 1,
      reason: 'dead',
      retriesAttempted: 1,
    })
    for (const call of mockEmit.mock.calls) {
      expect(call[0].metadata).toHaveProperty('browser')
      expect(call[0].metadata).toHaveProperty('isMobile')
    }
  })
})
