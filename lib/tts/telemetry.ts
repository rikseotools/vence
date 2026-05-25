// lib/tts/telemetry.ts
//
// Wrapper tipado sobre `emitClientEvent` (lib/observability/client.ts) para
// los eventos TTS. Una sola fuente de verdad de la taxonomía + metadata.
//
// Catálogo completo: docs/runbooks/observability.md §TTS.
//
// Diseño:
//   - Una sesión TTS = un play() = un sessionId UUID.
//   - tts_session_start lleva el contexto completo (browser, device, ley).
//   - El resto de eventos referencia el sessionId — no repiten contexto.
//   - Sample rates configurados en lib/observability/client.ts.

'use client'

import { emitClientEvent } from '@/lib/observability/client'
import type { BrowserContext, TTSEndReason } from './types'

// ─── Browser context, detectado una sola vez por carga de página ────────

let cachedBrowserContext: BrowserContext | null = null

export function getBrowserContext(): BrowserContext {
  if (cachedBrowserContext) return cachedBrowserContext
  if (typeof navigator === 'undefined') {
    return {
      browser: 'other',
      isMobile: false,
      userAgent: '',
    }
  }
  const ua = navigator.userAgent
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
  const isEdge = /Edg\//.test(ua)
  const isChrome = /Chrome/i.test(ua) && !isEdge
  const isFirefox = /Firefox/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge
  const browser: BrowserContext['browser'] = isEdge
    ? 'edge'
    : isChrome
      ? 'chrome'
      : isFirefox
        ? 'firefox'
        : isSafari
          ? 'safari'
          : 'other'

  cachedBrowserContext = {
    browser,
    isMobile,
    userAgent: ua.slice(0, 200),
  }
  return cachedBrowserContext
}

// ─── SessionId generator ────────────────────────────────────────────────

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `tts-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

// ─── Eventos TTS (tipados) ──────────────────────────────────────────────

export interface TTSSessionStartMeta {
  sessionId: string
  lawName?: string
  articleNumber?: string
  chunksTotal: number
  textLen: number
  voiceURI: string | null
  voiceName: string | null
  rate: number
}

export interface TTSSessionEndMeta {
  sessionId: string
  endReason: TTSEndReason
  durationMs: number
  chunksCompleted: number
  chunksTotal: number
  chunksSkipped: number
}

export interface TTSChunkSkipMeta {
  sessionId: string
  chunkIdx: number
  chunksTotal: number
  reason: 'dead' | 'zombie'
  retriesAttempted: number
}

export interface TTSWatchdogRetryMeta {
  sessionId: string
  chunkIdx: number
  retryNum: number
  reason: 'dead' | 'zombie'
}

export interface TTSNoVoicesMeta {
  totalVoices: number
  spanishVoices: number
  voicesLoaded: boolean
}

export interface TTSVoicesLoadTimeoutMeta {
  waitedMs: number
}

export interface TTSChainAdvanceMeta {
  fromSessionId: string
  fromLaw?: string
  toLaw?: string
}

export interface TTSErrorMeta {
  sessionId: string
  atChunkIdx: number
  errorType: string
  message?: string
}

export interface TTSUserActionMeta {
  sessionId: string
  action: 'pause' | 'resume' | 'stop' | 'rate_change' | 'voice_change'
  atChunkIdx: number
  fromValue?: number | string | null
  toValue?: number | string | null
}

// Atajo: enriquecer metadata con browser context (siempre presente para
// segmentar luego en SQL).
function enrichMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const ctx = getBrowserContext()
  return {
    ...meta,
    browser: ctx.browser,
    isMobile: ctx.isMobile,
  }
}

export const ttsTelemetry = {
  sessionStart(meta: TTSSessionStartMeta): void {
    emitClientEvent({
      severity: 'info',
      eventType: 'tts_session_start',
      metadata: enrichMeta({ ...meta, userAgent: getBrowserContext().userAgent }),
    })
  },

  sessionEnd(meta: TTSSessionEndMeta): void {
    const severity = meta.endReason === 'error' ? 'warn' : 'info'
    emitClientEvent({
      severity,
      eventType: 'tts_session_end',
      durationMs: meta.durationMs,
      metadata: enrichMeta({ ...meta }),
    })
  },

  chunkSkip(meta: TTSChunkSkipMeta): void {
    emitClientEvent({
      severity: 'warn',
      eventType: 'tts_chunk_skip',
      errorMessage: `TTS chunk ${meta.chunkIdx}/${meta.chunksTotal} ${meta.reason} tras ${meta.retriesAttempted} retries`,
      metadata: enrichMeta({ ...meta }),
    })
  },

  watchdogRetry(meta: TTSWatchdogRetryMeta): void {
    emitClientEvent({
      severity: 'debug',
      eventType: 'tts_watchdog_retry',
      metadata: enrichMeta({ ...meta }),
    })
  },

  noVoices(meta: TTSNoVoicesMeta): void {
    emitClientEvent({
      severity: 'warn',
      eventType: 'tts_no_voices',
      errorMessage: `TTS sin voces ES disponibles (total: ${meta.totalVoices}, es: ${meta.spanishVoices})`,
      metadata: enrichMeta({ ...meta }),
    })
  },

  voicesLoadTimeout(meta: TTSVoicesLoadTimeoutMeta): void {
    emitClientEvent({
      severity: 'warn',
      eventType: 'tts_voices_load_timeout',
      errorMessage: `TTS voiceschanged no disparó en ${meta.waitedMs}ms`,
      metadata: enrichMeta({ ...meta }),
    })
  },

  chainAdvance(meta: TTSChainAdvanceMeta): void {
    emitClientEvent({
      severity: 'info',
      eventType: 'tts_chain_advance',
      metadata: enrichMeta({ ...meta }),
    })
  },

  error(meta: TTSErrorMeta): void {
    emitClientEvent({
      severity: 'error',
      eventType: 'tts_error',
      errorMessage: meta.message ?? `TTS error in chunk ${meta.atChunkIdx}: ${meta.errorType}`,
      metadata: enrichMeta({ ...meta }),
    })
  },

  unsupported(): void {
    emitClientEvent({
      severity: 'warn',
      eventType: 'tts_unsupported',
      errorMessage: 'Web Speech API no soportada en este navegador',
      metadata: enrichMeta({}),
    })
  },

  userAction(meta: TTSUserActionMeta): void {
    emitClientEvent({
      severity: 'debug',
      eventType: 'tts_user_action',
      metadata: enrichMeta({ ...meta }),
    })
  },
}

export type TTSTelemetry = typeof ttsTelemetry
