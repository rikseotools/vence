// lib/tts/types.ts
//
// Tipos compartidos del motor TTS robusto (Web Speech). Diseño:
//
//   ArticleTTS (UI) → useTTS (hook) → TTSEngine (clase) → SpeechSynthesis (browser)
//                                            ↓
//                                       TTSTelemetry → observable_events
//
// El state machine vive en `stateMachine.ts` y es pura — se testea sin DOM.

export type TTSState =
  | 'idle'           // estado inicial, no ha sonado nada
  | 'loading_voices' // esperando a que voiceschanged dispare
  | 'playing'        // reproduciendo activamente
  | 'paused'         // pausado por el usuario
  | 'ended'          // terminó natural (chunks completados)
  | 'stopped'        // parado por el usuario o cleanup
  | 'error'          // error fatal

export type TTSEventType =
  | 'PLAY'
  | 'PAUSE'
  | 'RESUME'
  | 'STOP'
  | 'NATURAL_END'
  | 'FATAL_ERROR'
  | 'VOICES_LOADED'
  | 'VOICES_TIMEOUT'

export type TTSEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'NATURAL_END' }
  | { type: 'FATAL_ERROR'; error: string }
  | { type: 'VOICES_LOADED' }
  | { type: 'VOICES_TIMEOUT' }

export interface TTSProgress {
  currentChunk: number // 0-indexed, hasta totalChunks-1
  totalChunks: number
  percent: number // 0-100, redondeado
}

export interface TTSPlayOptions {
  text: string
  rate: number
  voiceURI?: string | null
  /** Para telemetría — identificación de la ley/artículo siendo leído. */
  lawName?: string
  articleNumber?: string
}

/**
 * Razón por la que terminó una sesión TTS. Usado en `tts_session_end`.
 *
 * - `natural`: todos los chunks reprodujeron correctamente
 * - `user_stop`: el usuario pulsó "Parar"
 * - `unmount`: el componente se desmontó (navegación, etc.)
 * - `error`: error fatal no recuperable
 * - `chain_advance`: terminó natural y el chain pasó a la siguiente ley
 *   (caso especial de `natural` para correlar con `tts_chain_advance`)
 */
export type TTSEndReason =
  | 'natural'
  | 'user_stop'
  | 'unmount'
  | 'error'
  | 'chain_advance'

export interface BrowserContext {
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'other'
  isMobile: boolean
  userAgent: string // truncado
}
