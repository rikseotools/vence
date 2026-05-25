// lib/tts/stateMachine.ts
//
// State machine PURO del motor TTS. Sin React, sin DOM, sin side effects.
// Single source of truth: cualquier consumer (UI, telemetría, engine)
// debe consultar/transicionar a través de aquí.
//
// Diseño explícito en `TRANSITIONS`. Si una transición no aparece en la
// tabla, es ilegal y `transition()` devuelve null (el caller decide si
// loguear como bug o ignorar).
//
// Invariantes garantizadas:
//   - NATURAL_END solo se acepta desde `playing` → idempotente: si el
//     engine la emite dos veces (bug de Chrome con onend duplicado),
//     la segunda devuelve null en lugar de re-disparar chain advance.
//   - STOP siempre lleva a `stopped` desde cualquier estado activo.
//   - Tras `ended`/`stopped`/`error`, PLAY reinicia la sesión.

import type { TTSEvent, TTSEventType, TTSState } from './types'

/**
 * Tabla de transiciones legales. `TRANSITIONS[state][event]` da el siguiente
 * estado, o `undefined` si la transición es ilegal.
 *
 * Convención: terminal states (`ended`, `stopped`, `error`) solo aceptan
 * `PLAY` para reiniciar. Esto IMPIDE el bucle donde NATURAL_END duplicado
 * vuelve a notificar al chain (el bug que sufría Nila).
 */
export const TRANSITIONS: Record<
  TTSState,
  Partial<Record<TTSEventType, TTSState>>
> = {
  idle: {
    PLAY: 'playing',
    VOICES_TIMEOUT: 'error', // caso edge: timeout antes de play
  },
  loading_voices: {
    VOICES_LOADED: 'playing',
    VOICES_TIMEOUT: 'error',
    STOP: 'stopped',
  },
  playing: {
    PAUSE: 'paused',
    STOP: 'stopped',
    NATURAL_END: 'ended',
    FATAL_ERROR: 'error',
  },
  paused: {
    RESUME: 'playing',
    STOP: 'stopped',
    FATAL_ERROR: 'error',
  },
  ended: {
    PLAY: 'playing',
  },
  stopped: {
    PLAY: 'playing',
  },
  error: {
    PLAY: 'playing',
    STOP: 'stopped',
  },
}

/**
 * Aplica una transición. Retorna el nuevo estado, o `null` si la
 * transición es ilegal.
 *
 * El motor debe llamarlo y, si recibe null, NO ejecutar el side effect
 * asociado (cancel speech, emit chain advance, etc.).
 */
export function transition(
  state: TTSState,
  event: TTSEvent,
): TTSState | null {
  const allowed = TRANSITIONS[state]?.[event.type]
  return allowed ?? null
}

/** True si la transición sería legal (sin aplicarla). */
export function canTransition(state: TTSState, eventType: TTSEventType): boolean {
  return TRANSITIONS[state]?.[eventType] !== undefined
}

/** True si el estado es terminal (necesita PLAY para reiniciar). */
export function isTerminal(state: TTSState): boolean {
  return state === 'ended' || state === 'stopped' || state === 'error'
}

/** True si el motor está reproduciendo activamente sonido. */
export function isPlaying(state: TTSState): boolean {
  return state === 'playing'
}

/** True si el motor está pausado (puede reanudar). */
export function isPaused(state: TTSState): boolean {
  return state === 'paused'
}

/** True si el motor está activo (playing o paused). */
export function isActive(state: TTSState): boolean {
  return state === 'playing' || state === 'paused'
}
