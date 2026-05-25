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

/**
 * Sección reproducible. En el contexto del temario, cada artículo es una
 * sección. El engine usa esto para soportar navegación (next/prev/restart
 * por artículo) y mostrar al usuario por dónde va.
 */
export interface TTSSection {
  /** Identificador estable — típicamente articleNumber. */
  id: string
  /** Etiqueta para mostrar al usuario: "Artículo 5", "Disposición Adicional 2ª", etc. */
  label: string
  /** Texto a sintetizar. Suele incluir el prefijo "Artículo X." para que se oiga. */
  text: string
}

/** Metadata de un chunk procesable por el motor. */
export interface TTSChunkMeta {
  /** Texto del chunk (≤ MAX_CHUNK_LENGTH chars). */
  text: string
  /** Índice de la sección a la que pertenece este chunk. */
  sectionIdx: number
}

/** Estado de la sección actualmente reproducida — derivado de currentChunkIdx. */
export interface TTSCurrentSection {
  /** Índice de la sección actual (0-indexed). */
  idx: number
  /** Label visible al usuario. */
  label: string
  /** Total de secciones. */
  total: number
}

export interface TTSPlayOptions {
  /**
   * Texto plano. Para back-compat con el uso antiguo donde la ley
   * llegaba como string concatenado. Si se pasa `sections`, este campo
   * se ignora. Si se pasa solo `text`, el motor crea una única sección.
   */
  text?: string
  /**
   * Secciones estructuradas (preferido). Cada artículo = una sección.
   * Habilita navegación next/prev y display "Artículo X / N".
   */
  sections?: TTSSection[]
  rate: number
  voiceURI?: string | null
  /** Para telemetría — identificación de la ley siendo leída. */
  lawName?: string
  /** Para telemetría — sólo tiene sentido en el modo legacy `text`. */
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
