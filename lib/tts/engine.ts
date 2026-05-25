// lib/tts/engine.ts
//
// Motor TTS robusto sobre Web Speech API. Encapsula:
//
//   - State machine (lib/tts/stateMachine.ts) como única fuente de verdad
//   - Watchdog único contra el bug de Chrome donde onend no dispara
//   - Telemetría completa a observable_events (lib/tts/telemetry.ts)
//   - Suscripción por listener pattern para que React (useTTS) re-renderice
//   - Cleanup explícito: destroy() libera todos los recursos
//
// NO usa setTimeout mágicos. NO usa pause()/resume() para keepalive (causa
// pérdida de onend en Chrome). Aceptamos que algunos chunks mueran silenciosos
// y el watchdog los detecta + retry + skip.
//
// Idempotencia clave: NATURAL_END solo se acepta desde `playing`. Si Chrome
// dispara onend dos veces para el mismo utterance (bug conocido), el segundo
// NATURAL_END devuelve null en la transición y NO re-notifica al chain.

'use client'

import {
  firstChunkOfSection,
  prepareForSpeech,
  prepareSectionsForSpeech,
} from './chunker'
import {
  canTransition,
  isActive,
  isPaused,
  isPlaying,
  isTerminal,
  transition,
} from './stateMachine'
import { newSessionId, ttsTelemetry } from './telemetry'
import type {
  TTSChunkMeta,
  TTSCurrentSection,
  TTSEndReason,
  TTSEvent,
  TTSPlayOptions,
  TTSProgress,
  TTSSection,
  TTSState,
} from './types'

const WATCHDOG_INTERVAL_MS = 2_000
const CHUNK_ZOMBIE_TIMEOUT_MS = 30_000
const MAX_WATCHDOG_RETRIES = 2
const VOICES_LOAD_TIMEOUT_MS = 3_000

export interface TTSEngineSnapshot {
  state: TTSState
  progress: TTSProgress
  /**
   * True si el próximo `play()` reanuda en lugar de empezar desde cero.
   * - paused → reanuda chunk pausado
   * - ended/stopped/error con chunks parciales → reanuda desde currentChunkIdx
   * El UI puede usarlo para mostrar "Continuar" en vez de "Escuchar".
   */
  canResume: boolean
  /**
   * Sección actual (artículo en contexto temario). Null si no hay sesión
   * activa o si el caller usó el modo `text` legacy sin sections.
   */
  currentSection: TTSCurrentSection | null
  /**
   * Nombre de la ley en curso (para que el floating player la muestre).
   * Null cuando no hay sesión activa.
   */
  lawName: string | null
}

export type TTSListener = (snapshot: TTSEngineSnapshot) => void

export interface TTSEngineCallbacks {
  /**
   * Llamado cuando la sesión termina natural (todos los chunks completados
   * sin que el usuario pulsara stop). Usado por el chain context para
   * encadenar a la siguiente ley. IDEMPOTENTE — solo se invoca UNA vez
   * por sesión, garantizado por la state machine.
   */
  onNaturalEnd?: () => void
}

/**
 * Motor TTS. Una instancia por componente ArticleTTS. Vida = vida del
 * componente. Llamar `destroy()` en el unmount.
 */
export class TTSEngine {
  private state: TTSState = 'idle'
  private chunks: TTSChunkMeta[] = []
  private sections: TTSSection[] = []
  private currentChunkIdx = 0
  private chunksCompleted = 0
  private chunksSkipped = 0
  private sessionId: string | null = null
  private sessionStartTime = 0
  private lastPlayOptions: TTSPlayOptions | null = null
  /** Hash estable del contenido — se usa para detectar si el caller pidió
   *  reanudar la misma lectura (mismo texto/sections) vs arrancar limpio. */
  private contentKey = ''

  /** Utterance vivo. Null cuando no hay nada en curso. */
  private currentUtterance: SpeechSynthesisUtterance | null = null

  /** Marcador "salida programada del chunk actual" — evita carreras con
   *  el rate/voice swap donde cancelamos + relanzamos. */
  private chunkStartTime = 0

  private rate = 1.0
  private voiceURI: string | null = null

  private watchdogInterval: ReturnType<typeof setInterval> | null = null
  private watchdogRetries = 0

  private voicesLoadTimeoutHandle: ReturnType<typeof setTimeout> | null = null

  private listeners = new Set<TTSListener>()
  private callbacks: TTSEngineCallbacks

  /** Indica si el engine está destruido — bloquea cualquier callback tardío. */
  private destroyed = false

  constructor(callbacks: TTSEngineCallbacks = {}) {
    this.callbacks = callbacks
  }

  // ─── Public API ───────────────────────────────────────────────────────

  getState(): TTSState {
    return this.state
  }

  getSnapshot(): TTSEngineSnapshot {
    return {
      state: this.state,
      progress: this.computeProgress(),
      canResume: this.computeCanResume(),
      currentSection: this.computeCurrentSection(),
      lawName: this.lastPlayOptions?.lawName ?? null,
    }
  }

  private computeCanResume(): boolean {
    if (isPaused(this.state)) return true
    if (
      isTerminal(this.state) &&
      this.chunks.length > 0 &&
      this.currentChunkIdx > 0 &&
      this.currentChunkIdx < this.chunks.length
    ) {
      return true
    }
    return false
  }

  private computeCurrentSection(): TTSCurrentSection | null {
    if (this.sections.length === 0) return null
    if (this.chunks.length === 0) return null
    const clampedIdx = Math.min(
      Math.max(this.currentChunkIdx, 0),
      this.chunks.length - 1,
    )
    const chunk = this.chunks[clampedIdx]
    const section = this.sections[chunk.sectionIdx]
    if (!section) return null
    return {
      idx: chunk.sectionIdx,
      label: section.label,
      total: this.sections.length,
    }
  }

  subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Inicia / reanuda / reinicia la lectura. Reglas:
   *
   *   - Estado `paused` → reanuda desde el chunk pausado.
   *     Implementación: cancela + relanza el chunk actual. NO usamos
   *     `window.speechSynthesis.resume()` porque Chrome móvil mata la voz
   *     al ir a background y el resume nativo no la revive. Pérdida máxima:
   *     ~10s del chunk en curso (un chunk son ~250 chars).
   *
   *   - Estado terminal (`ended`/`stopped`/`error`) + MISMO texto →
   *     reanuda desde `currentChunkIdx`. Si ya pasamos el final, reinicia
   *     desde 0. Resuelve: usuario paró a mitad o el watchdog killed la
   *     sesión, vuelve a darle a Escuchar → no le hace empezar desde 0.
   *
   *   - Estado terminal + texto distinto → arranque limpio desde 0.
   *
   *   - Estado `playing` + play() de nuevo → cerramos sesión actual (user_stop)
   *     y arrancamos nueva (usuario clicó Escuchar en otra ley).
   */
  play(options: TTSPlayOptions): void {
    if (this.destroyed) return
    if (!this.isSpeechSupported()) {
      ttsTelemetry.unsupported()
      return
    }

    const incomingKey = computeContentKey(options)
    const incomingChunks = buildChunks(options)
    const incomingSections = buildSections(options)

    // ─── Caso 1: reanudar desde pausa ──────────────────────────────────
    if (isPaused(this.state)) {
      this.rate = options.rate
      this.voiceURI = options.voiceURI ?? null
      if (!this.transitionTo({ type: 'RESUME' })) return
      // Cancel + relanzar el chunk actual. Más fiable que resume() nativo
      // en Chrome móvil tras background.
      this.cancelCurrent()
      this.speakChunk(this.currentChunkIdx)
      this.startWatchdog()
      if (this.sessionId) {
        ttsTelemetry.userAction({
          sessionId: this.sessionId,
          action: 'resume',
          atChunkIdx: this.currentChunkIdx,
        })
      }
      this.notify()
      return
    }

    // ─── Caso 2: reanudar desde estado terminal con MISMO contenido ────
    const sameContent =
      this.contentKey === incomingKey && this.chunks.length > 0
    if (isTerminal(this.state) && sameContent) {
      // Si ya rebasamos el final (natural end), reiniciar desde 0.
      // Si paramos a mitad, retomar.
      const resumeIdx =
        this.currentChunkIdx >= this.chunks.length ? 0 : this.currentChunkIdx
      this.rate = options.rate
      this.voiceURI = options.voiceURI ?? null
      this.lastPlayOptions = options
      this.chunksCompleted = 0
      this.chunksSkipped = 0
      this.sessionId = newSessionId()
      this.sessionStartTime = Date.now()

      const voices = window.speechSynthesis.getVoices()
      const esVoices = voices.filter((v) => v.lang.startsWith('es'))
      if (esVoices.length === 0) {
        this.handleNoVoicesAtPlay(voices.length === 0)
        return
      }
      if (!this.transitionTo({ type: 'PLAY' })) return
      this.currentChunkIdx = resumeIdx
      this.emitSessionStart(esVoices)
      this.speakChunk(resumeIdx)
      this.startWatchdog()
      this.notify()
      return
    }

    // ─── Caso 3: usuario clicó play() mientras playing → cierre + nuevo ──
    if (isActive(this.state)) {
      this.endSession('user_stop')
    }

    // ─── Caso 4: arranque limpio ───────────────────────────────────────
    this.rate = options.rate
    this.voiceURI = options.voiceURI ?? null
    this.lastPlayOptions = options
    this.chunks = incomingChunks
    this.sections = incomingSections
    this.contentKey = incomingKey
    this.currentChunkIdx = 0
    this.chunksCompleted = 0
    this.chunksSkipped = 0
    this.sessionId = newSessionId()
    this.sessionStartTime = Date.now()

    const voices = window.speechSynthesis.getVoices()
    const esVoices = voices.filter((v) => v.lang.startsWith('es'))
    if (esVoices.length === 0) {
      this.handleNoVoicesAtPlay(voices.length === 0)
      return
    }

    if (!this.transitionTo({ type: 'PLAY' })) return
    this.emitSessionStart(esVoices)
    this.speakChunk(0)
    this.startWatchdog()
    this.notify()
  }

  // ─── Navegación por sección + seek ────────────────────────────────────

  /** Salta al primer chunk de la siguiente sección. No-op si ya está en la última. */
  nextSection(): void {
    if (this.destroyed) return
    if (!isActive(this.state)) return
    const cur = this.chunks[this.currentChunkIdx]
    if (!cur) return
    const targetSectionIdx = cur.sectionIdx + 1
    if (targetSectionIdx >= this.sections.length) return
    const toChunk = firstChunkOfSection(this.chunks, targetSectionIdx)
    if (toChunk < 0) return
    this.seekInternal(toChunk, 'next_section')
  }

  /** Salta al primer chunk de la sección anterior (o reinicia la actual si está dentro). */
  previousSection(): void {
    if (this.destroyed) return
    if (!isActive(this.state)) return
    const cur = this.chunks[this.currentChunkIdx]
    if (!cur) return
    const firstOfCurrent = firstChunkOfSection(this.chunks, cur.sectionIdx)
    // Si estamos avanzados dentro de la sección actual, volvemos al inicio
    // de ESTA sección. Si ya estamos en el inicio, retrocedemos una sección.
    const targetSectionIdx =
      this.currentChunkIdx > firstOfCurrent
        ? cur.sectionIdx
        : Math.max(0, cur.sectionIdx - 1)
    const toChunk = firstChunkOfSection(this.chunks, targetSectionIdx)
    if (toChunk < 0) return
    this.seekInternal(toChunk, 'prev_section')
  }

  /** Reinicia la sección actual desde su primer chunk. */
  restartSection(): void {
    if (this.destroyed) return
    if (!isActive(this.state)) return
    const cur = this.chunks[this.currentChunkIdx]
    if (!cur) return
    const toChunk = firstChunkOfSection(this.chunks, cur.sectionIdx)
    if (toChunk < 0 || toChunk === this.currentChunkIdx) return
    this.seekInternal(toChunk, 'restart_section')
  }

  /** Reinicia la ley entera desde el chunk 0. */
  restartLaw(): void {
    if (this.destroyed) return
    if (!isActive(this.state)) return
    if (this.currentChunkIdx === 0) return
    this.seekInternal(0, 'restart_law')
  }

  /** Seek a un porcentaje (0..1) sobre el total de chunks. */
  seekPercent(pct: number): void {
    if (this.destroyed) return
    if (!isActive(this.state)) return
    if (this.chunks.length === 0) return
    const clamped = Math.min(1, Math.max(0, pct))
    const toChunk = Math.min(
      this.chunks.length - 1,
      Math.floor(clamped * this.chunks.length),
    )
    if (toChunk === this.currentChunkIdx) return
    this.seekInternal(toChunk, 'drag')
  }

  private seekInternal(
    toChunk: number,
    method: 'next_section' | 'prev_section' | 'restart_section' | 'restart_law' | 'drag',
  ): void {
    const fromChunk = this.currentChunkIdx
    const fromSection = this.chunks[fromChunk]?.sectionIdx ?? 0
    const toSection = this.chunks[toChunk]?.sectionIdx ?? 0

    if (this.sessionId) {
      ttsTelemetry.seek({
        sessionId: this.sessionId,
        method,
        fromChunkIdx: fromChunk,
        toChunkIdx: toChunk,
        fromSectionIdx: fromSection,
        toSectionIdx: toSection,
      })
    }
    this.cancelCurrent()
    // Si estábamos pausados, transicionamos a playing antes de hablar.
    // (Aunque nextSection/etc. solo aplican en `playing`, queda preparado
    // para futuros casos.)
    this.speakChunk(toChunk)
  }

  private handleNoVoicesAtPlay(voicesAreEmpty: boolean): void {
    if (voicesAreEmpty) {
      // Esperar a voiceschanged
      this.state = 'loading_voices'
      this.notify()
      this.waitForVoices()
      return
    }
    // Hay voces pero ninguna en español → telemetría y volver a idle
    const total = window.speechSynthesis.getVoices().length
    ttsTelemetry.noVoices({
      totalVoices: total,
      spanishVoices: 0,
      voicesLoaded: true,
    })
  }

  pause(): void {
    if (this.destroyed) return
    if (!isPlaying(this.state)) return
    if (!this.transitionTo({ type: 'PAUSE' })) return
    window.speechSynthesis.pause()
    this.stopWatchdog()
    if (this.sessionId) {
      ttsTelemetry.userAction({
        sessionId: this.sessionId,
        action: 'pause',
        atChunkIdx: this.currentChunkIdx,
      })
    }
    this.notify()
  }

  resume(): void {
    if (this.destroyed) return
    if (!isPaused(this.state)) return
    if (!this.transitionTo({ type: 'RESUME' })) return
    // Cancel + relanzar el chunk actual desde su inicio. Más fiable que
    // `window.speechSynthesis.resume()` en Chrome móvil tras background.
    // Pérdida máxima: ~10s del chunk en curso (≤250 chars).
    this.cancelCurrent()
    this.speakChunk(this.currentChunkIdx)
    this.startWatchdog()
    if (this.sessionId) {
      ttsTelemetry.userAction({
        sessionId: this.sessionId,
        action: 'resume',
        atChunkIdx: this.currentChunkIdx,
      })
    }
    this.notify()
  }

  stop(): void {
    if (this.destroyed) return
    if (!isActive(this.state) && this.state !== 'loading_voices') return
    if (this.sessionId) {
      ttsTelemetry.userAction({
        sessionId: this.sessionId,
        action: 'stop',
        atChunkIdx: this.currentChunkIdx,
      })
    }
    this.endSession('user_stop')
  }

  /**
   * Cambia rate en caliente. Si está reproduciendo, cancela + reinicia el
   * chunk actual con el nuevo rate. Si está pausado, queda registrado
   * para aplicarse en resume.
   *
   * NO-OP si el valor es idéntico al actual — esto es CRÍTICO: ArticleTTS
   * llama setRate(rate) desde un useEffect cuyas deps incluyen rate, y
   * React puede disparar el efecto en mounts/re-renders con el mismo valor.
   * Sin esta guard, cada setRate(1)+setVoice(null) cancela el chunk
   * recién iniciado → no se oye nada.
   */
  setRate(rate: number): void {
    if (this.destroyed) return
    if (rate === this.rate) return
    const oldRate = this.rate
    this.rate = rate
    if (this.sessionId) {
      ttsTelemetry.userAction({
        sessionId: this.sessionId,
        action: 'rate_change',
        atChunkIdx: this.currentChunkIdx,
        fromValue: oldRate,
        toValue: rate,
      })
    }
    if (isPlaying(this.state)) {
      this.cancelCurrent()
      this.speakChunk(this.currentChunkIdx)
    }
  }

  setVoice(voiceURI: string | null): void {
    if (this.destroyed) return
    if ((voiceURI ?? null) === this.voiceURI) return
    const oldVoice = this.voiceURI
    this.voiceURI = voiceURI ?? null
    if (this.sessionId) {
      ttsTelemetry.userAction({
        sessionId: this.sessionId,
        action: 'voice_change',
        atChunkIdx: this.currentChunkIdx,
        fromValue: oldVoice,
        toValue: voiceURI,
      })
    }
    if (isPlaying(this.state)) {
      this.cancelCurrent()
      this.speakChunk(this.currentChunkIdx)
    }
  }

  /**
   * Libera todos los recursos. Llamar en el unmount del componente.
   * Si había sesión activa, telemetría con endReason='unmount'.
   */
  destroy(): void {
    if (this.destroyed) return
    if (isActive(this.state)) {
      this.endSession('unmount')
    }
    this.stopWatchdog()
    if (this.voicesLoadTimeoutHandle) {
      clearTimeout(this.voicesLoadTimeoutHandle)
      this.voicesLoadTimeoutHandle = null
    }
    this.cancelCurrent()
    this.destroyed = true
    this.listeners.clear()
  }

  // ─── Private: state machine ───────────────────────────────────────────

  private transitionTo(event: TTSEvent): boolean {
    const next = transition(this.state, event)
    if (next === null) return false
    this.state = next
    return true
  }

  // ─── Private: chunk playback ──────────────────────────────────────────

  private speakChunk(index: number): void {
    if (this.destroyed) return

    // Llegamos al final → natural end (idempotente por state machine).
    if (index >= this.chunks.length) {
      this.handleNaturalEnd()
      return
    }

    this.currentChunkIdx = index
    this.chunkStartTime = Date.now()
    this.watchdogRetries = 0

    const utterance = new SpeechSynthesisUtterance(this.chunks[index].text)
    utterance.lang = 'es-ES'
    utterance.rate = this.rate

    const voice = this.pickVoice()
    if (voice) utterance.voice = voice

    // Bind handlers — capturan el index y se desactivan en cancelCurrent().
    utterance.onend = () => {
      // Solo honramos onend del utterance vivo (evita race con cancel + new).
      if (utterance !== this.currentUtterance) return
      if (!isPlaying(this.state)) return
      this.chunksCompleted++
      this.speakChunk(index + 1)
    }

    utterance.onerror = (e) => {
      if (utterance !== this.currentUtterance) return
      // 'interrupted'/'canceled' es esperado tras cancel() — ignorar.
      if (e.error === 'interrupted' || e.error === 'canceled') return
      if (!isPlaying(this.state)) return
      // Otro error → telemetría + intentar siguiente chunk
      if (this.sessionId) {
        ttsTelemetry.error({
          sessionId: this.sessionId,
          atChunkIdx: index,
          errorType: e.error || 'unknown',
        })
      }
      this.speakChunk(index + 1)
    }

    this.currentUtterance = utterance
    this.updateProgress()
    window.speechSynthesis.speak(utterance)
  }

  private cancelCurrent(): void {
    if (this.currentUtterance) {
      // Desactivar handlers del utterance que vamos a cancelar para evitar
      // que 'interrupted' o un onend duplicado disparen lógica obsoleta.
      this.currentUtterance.onend = null
      this.currentUtterance.onerror = null
      this.currentUtterance = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  private handleNaturalEnd(): void {
    // Si la state machine ya está en `ended` (duplicate onend), null y
    // no hacemos nada → ESTO ARREGLA EL BUCLE.
    if (!this.transitionTo({ type: 'NATURAL_END' })) return
    this.endSession('natural')
    this.callbacks.onNaturalEnd?.()
  }

  private endSession(reason: TTSEndReason): void {
    if (reason === 'user_stop' || reason === 'unmount' || reason === 'error') {
      // Estos requieren transición vía STOP/FATAL_ERROR
      if (reason === 'error') {
        // Si ya en error, transitionTo devuelve null y no doble-emite.
        // Caller debe haber llamado a transitionTo({type:'FATAL_ERROR'})
        // antes — aquí solo emitimos sessionEnd.
      } else if (isActive(this.state) || this.state === 'loading_voices') {
        this.transitionTo({ type: 'STOP' })
      }
    }

    this.cancelCurrent()
    this.stopWatchdog()

    if (this.sessionId) {
      ttsTelemetry.sessionEnd({
        sessionId: this.sessionId,
        endReason: reason,
        durationMs: Date.now() - this.sessionStartTime,
        chunksCompleted: this.chunksCompleted,
        chunksTotal: this.chunks.length,
        chunksSkipped: this.chunksSkipped,
      })
      this.sessionId = null
    }

    this.notify()
  }

  // ─── Private: watchdog ────────────────────────────────────────────────

  private startWatchdog(): void {
    this.stopWatchdog()
    this.watchdogInterval = setInterval(() => this.tickWatchdog(), WATCHDOG_INTERVAL_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval)
      this.watchdogInterval = null
    }
  }

  private tickWatchdog(): void {
    if (this.destroyed) return
    if (!isPlaying(this.state)) return
    if (this.currentChunkIdx >= this.chunks.length) return

    const synth = window.speechSynthesis
    const now = Date.now()
    const chunkAge = now - this.chunkStartTime

    // Caso 1: speech murió silenciosamente (Chrome bug ~15s)
    if (!synth.speaking && !synth.pending) {
      this.handleDeadOrZombie('dead')
      return
    }

    // Caso 2: chunk zombie (>30s sin onend)
    if (synth.speaking && chunkAge > CHUNK_ZOMBIE_TIMEOUT_MS) {
      this.handleDeadOrZombie('zombie')
    }
  }

  private handleDeadOrZombie(reason: 'dead' | 'zombie'): void {
    if (!this.sessionId) return
    this.watchdogRetries++

    if (this.watchdogRetries > MAX_WATCHDOG_RETRIES) {
      // Saltamos el chunk
      ttsTelemetry.chunkSkip({
        sessionId: this.sessionId,
        chunkIdx: this.currentChunkIdx,
        chunksTotal: this.chunks.length,
        reason,
        retriesAttempted: this.watchdogRetries,
      })
      this.chunksSkipped++
      this.cancelCurrent()
      this.speakChunk(this.currentChunkIdx + 1)
      return
    }

    // Retry del chunk actual
    ttsTelemetry.watchdogRetry({
      sessionId: this.sessionId,
      chunkIdx: this.currentChunkIdx,
      retryNum: this.watchdogRetries,
      reason,
    })
    this.cancelCurrent()
    this.speakChunk(this.currentChunkIdx)
  }

  // ─── Private: voices loading ──────────────────────────────────────────

  private waitForVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const startedAt = Date.now()

    const handler = () => {
      if (this.destroyed) return
      if (this.state !== 'loading_voices') {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        return
      }
      const voices = window.speechSynthesis.getVoices()
      const esVoices = voices.filter((v) => v.lang.startsWith('es'))
      if (esVoices.length > 0) {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        if (this.voicesLoadTimeoutHandle) {
          clearTimeout(this.voicesLoadTimeoutHandle)
          this.voicesLoadTimeoutHandle = null
        }
        if (!this.transitionTo({ type: 'VOICES_LOADED' })) return
        this.emitSessionStart(esVoices)
        this.speakChunk(0)
        this.startWatchdog()
        this.notify()
      } else if (voices.length > 0) {
        // Cargaron pero sin español
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        if (this.voicesLoadTimeoutHandle) {
          clearTimeout(this.voicesLoadTimeoutHandle)
          this.voicesLoadTimeoutHandle = null
        }
        ttsTelemetry.noVoices({
          totalVoices: voices.length,
          spanishVoices: 0,
          voicesLoaded: true,
        })
        // Volvemos a idle (cancelamos sesión)
        if (this.transitionTo({ type: 'STOP' })) {
          this.notify()
        }
      }
    }

    window.speechSynthesis.addEventListener('voiceschanged', handler)

    this.voicesLoadTimeoutHandle = setTimeout(() => {
      if (this.destroyed) return
      if (this.state !== 'loading_voices') return
      window.speechSynthesis.removeEventListener('voiceschanged', handler)
      ttsTelemetry.voicesLoadTimeout({ waitedMs: Date.now() - startedAt })
      // Última oportunidad: leemos getVoices() por si el evento nunca disparó
      const voices = window.speechSynthesis.getVoices()
      const esVoices = voices.filter((v) => v.lang.startsWith('es'))
      if (esVoices.length > 0) {
        if (!this.transitionTo({ type: 'VOICES_LOADED' })) return
        this.emitSessionStart(esVoices)
        this.speakChunk(0)
        this.startWatchdog()
        this.notify()
        return
      }
      ttsTelemetry.noVoices({
        totalVoices: voices.length,
        spanishVoices: esVoices.length,
        voicesLoaded: false,
      })
      if (this.transitionTo({ type: 'VOICES_TIMEOUT' })) {
        this.notify()
      }
    }, VOICES_LOAD_TIMEOUT_MS)
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null
    }
    const voices = window.speechSynthesis.getVoices()
    if (this.voiceURI) {
      const found = voices.find((v) => v.voiceURI === this.voiceURI)
      if (found) return found
    }
    return (
      voices.find((v) => v.lang === 'es-ES' && v.name.includes('Google')) ||
      voices.find((v) => v.lang === 'es-ES') ||
      voices.find((v) => v.lang.startsWith('es')) ||
      null
    )
  }

  // ─── Private: telemetry helpers ───────────────────────────────────────

  private computeTotalTextLen(): number {
    if (!this.lastPlayOptions) return 0
    if (this.lastPlayOptions.sections?.length) {
      return this.lastPlayOptions.sections.reduce(
        (acc, s) => acc + s.text.length,
        0,
      )
    }
    return this.lastPlayOptions.text?.length ?? 0
  }

  private emitSessionStart(spanishVoices: SpeechSynthesisVoice[]): void {
    if (!this.sessionId || !this.lastPlayOptions) return
    const chosen = this.pickVoice()
    ttsTelemetry.sessionStart({
      sessionId: this.sessionId,
      lawName: this.lastPlayOptions.lawName,
      articleNumber: this.lastPlayOptions.articleNumber,
      chunksTotal: this.chunks.length,
      textLen: this.computeTotalTextLen(),
      voiceURI: chosen?.voiceURI ?? null,
      voiceName: chosen?.name ?? null,
      rate: this.rate,
    })
    // marca para uso futuro
    void spanishVoices
  }

  // ─── Private: progress + listeners ────────────────────────────────────

  private computeProgress(): TTSProgress {
    const total = this.chunks.length
    const current = Math.min(this.currentChunkIdx + 1, Math.max(total, 1))
    return {
      currentChunk: this.currentChunkIdx,
      totalChunks: total,
      percent: total > 0 ? Math.round((current / total) * 100) : 0,
    }
  }

  private updateProgress(): void {
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getSnapshot()
    for (const l of this.listeners) {
      try {
        l(snapshot)
      } catch {
        /* listener no debe romper engine */
      }
    }
  }

  private isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  // ─── Test-only ────────────────────────────────────────────────────────

  /** Solo para tests — expone estado interno. NO usar en producción. */
  _debugState() {
    return {
      state: this.state,
      currentChunkIdx: this.currentChunkIdx,
      chunksCompleted: this.chunksCompleted,
      chunksSkipped: this.chunksSkipped,
      watchdogRetries: this.watchdogRetries,
      sessionId: this.sessionId,
      destroyed: this.destroyed,
    }
  }

  /** Solo para tests — disparar watchdog manualmente. */
  _debugTickWatchdog() {
    this.tickWatchdog()
  }
}

// ─── Helpers internos (puros) ─────────────────────────────────────────────

/**
 * Convierte las opciones del caller en sections normalizadas. Si vino solo
 * `text` (modo legacy), creamos una única sección sin label.
 */
function buildSections(options: TTSPlayOptions): TTSSection[] {
  if (options.sections && options.sections.length > 0) {
    return options.sections
  }
  if (options.text) {
    return [
      {
        id: options.articleNumber ?? '0',
        label: options.articleNumber
          ? `Artículo ${options.articleNumber}`
          : options.lawName ?? 'Texto',
        text: options.text,
      },
    ]
  }
  return []
}

function buildChunks(options: TTSPlayOptions): TTSChunkMeta[] {
  if (options.sections && options.sections.length > 0) {
    return prepareSectionsForSpeech(options.sections)
  }
  if (options.text) {
    return prepareForSpeech(options.text).map((text) => ({
      text,
      sectionIdx: 0,
    }))
  }
  return [{ text: '', sectionIdx: 0 }]
}

/**
 * Clave estable del contenido. Para sections: concatenación de section ids
 * + length de textos. Para text: el text directamente. Permite detectar
 * "mismo contenido" para reanudar sin tener que comparar el texto entero.
 */
function computeContentKey(options: TTSPlayOptions): string {
  if (options.sections && options.sections.length > 0) {
    return options.sections
      .map((s) => `${s.id}:${s.text.length}`)
      .join('|')
  }
  return options.text ?? ''
}
