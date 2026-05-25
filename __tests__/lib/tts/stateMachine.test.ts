// __tests__/lib/tts/stateMachine.test.ts
//
// Tests del state machine puro. Sin DOM, sin mocks. Verifica que:
//   - cada transición legal funciona
//   - cada transición ilegal devuelve null
//   - NATURAL_END es idempotente (el bug del bucle de Nila)

import {
  canTransition,
  isActive,
  isPaused,
  isPlaying,
  isTerminal,
  transition,
  TRANSITIONS,
} from '@/lib/tts/stateMachine'
import type { TTSEvent, TTSState } from '@/lib/tts/types'

describe('TTS stateMachine', () => {
  describe('transition() — transiciones legales', () => {
    it('idle → playing con PLAY', () => {
      expect(transition('idle', { type: 'PLAY' })).toBe('playing')
    })

    it('loading_voices → playing con VOICES_LOADED', () => {
      expect(transition('loading_voices', { type: 'VOICES_LOADED' })).toBe(
        'playing',
      )
    })

    it('loading_voices → error con VOICES_TIMEOUT', () => {
      expect(transition('loading_voices', { type: 'VOICES_TIMEOUT' })).toBe(
        'error',
      )
    })

    it('playing → paused con PAUSE', () => {
      expect(transition('playing', { type: 'PAUSE' })).toBe('paused')
    })

    it('playing → stopped con STOP', () => {
      expect(transition('playing', { type: 'STOP' })).toBe('stopped')
    })

    it('playing → ended con NATURAL_END', () => {
      expect(transition('playing', { type: 'NATURAL_END' })).toBe('ended')
    })

    it('playing → error con FATAL_ERROR', () => {
      expect(
        transition('playing', { type: 'FATAL_ERROR', error: 'x' }),
      ).toBe('error')
    })

    it('paused → playing con RESUME', () => {
      expect(transition('paused', { type: 'RESUME' })).toBe('playing')
    })

    it('paused → stopped con STOP', () => {
      expect(transition('paused', { type: 'STOP' })).toBe('stopped')
    })

    it('ended → playing con PLAY (reinicio)', () => {
      expect(transition('ended', { type: 'PLAY' })).toBe('playing')
    })

    it('stopped → playing con PLAY (reinicio)', () => {
      expect(transition('stopped', { type: 'PLAY' })).toBe('playing')
    })

    it('error → playing con PLAY (recovery)', () => {
      expect(transition('error', { type: 'PLAY' })).toBe('playing')
    })
  })

  describe('transition() — transiciones ILEGALES devuelven null', () => {
    it('idle no acepta PAUSE/RESUME/STOP/NATURAL_END', () => {
      expect(transition('idle', { type: 'PAUSE' })).toBeNull()
      expect(transition('idle', { type: 'RESUME' })).toBeNull()
      expect(transition('idle', { type: 'STOP' })).toBeNull()
      expect(transition('idle', { type: 'NATURAL_END' })).toBeNull()
    })

    it('paused no acepta PLAY ni PAUSE (solo RESUME y STOP)', () => {
      expect(transition('paused', { type: 'PLAY' })).toBeNull()
      expect(transition('paused', { type: 'PAUSE' })).toBeNull()
      expect(transition('paused', { type: 'NATURAL_END' })).toBeNull()
    })

    it('playing no acepta PLAY ni RESUME', () => {
      expect(transition('playing', { type: 'PLAY' })).toBeNull()
      expect(transition('playing', { type: 'RESUME' })).toBeNull()
    })
  })

  describe('IDEMPOTENCIA de NATURAL_END (fix bucle Nila)', () => {
    it('una vez en `ended`, NATURAL_END devuelve null — no re-dispara chain', () => {
      // Simula bug Chrome: onend dispara dos veces para el mismo utterance.
      // Primera vez: playing → ended.
      // Segunda vez: ended → NATURAL_END → null (no efecto).
      const afterFirst = transition('playing', { type: 'NATURAL_END' })
      expect(afterFirst).toBe('ended')
      const afterSecond = transition(afterFirst!, { type: 'NATURAL_END' })
      expect(afterSecond).toBeNull()
    })

    it('una vez en `stopped`, NATURAL_END devuelve null', () => {
      expect(transition('stopped', { type: 'NATURAL_END' })).toBeNull()
    })

    it('una vez en `error`, NATURAL_END devuelve null', () => {
      expect(transition('error', { type: 'NATURAL_END' })).toBeNull()
    })
  })

  describe('canTransition()', () => {
    it('coincide con TRANSITIONS', () => {
      expect(canTransition('idle', 'PLAY')).toBe(true)
      expect(canTransition('idle', 'PAUSE')).toBe(false)
      expect(canTransition('playing', 'NATURAL_END')).toBe(true)
      expect(canTransition('ended', 'NATURAL_END')).toBe(false)
    })
  })

  describe('helpers de estado', () => {
    it('isTerminal', () => {
      expect(isTerminal('ended')).toBe(true)
      expect(isTerminal('stopped')).toBe(true)
      expect(isTerminal('error')).toBe(true)
      expect(isTerminal('playing')).toBe(false)
      expect(isTerminal('paused')).toBe(false)
      expect(isTerminal('idle')).toBe(false)
      expect(isTerminal('loading_voices')).toBe(false)
    })

    it('isPlaying', () => {
      expect(isPlaying('playing')).toBe(true)
      expect(isPlaying('paused')).toBe(false)
      expect(isPlaying('ended')).toBe(false)
    })

    it('isPaused', () => {
      expect(isPaused('paused')).toBe(true)
      expect(isPaused('playing')).toBe(false)
    })

    it('isActive (playing OR paused)', () => {
      expect(isActive('playing')).toBe(true)
      expect(isActive('paused')).toBe(true)
      expect(isActive('idle')).toBe(false)
      expect(isActive('ended')).toBe(false)
    })
  })

  describe('TRANSITIONS — exhaustividad', () => {
    it('cada state tiene al menos una transición saliente', () => {
      const states: TTSState[] = [
        'idle',
        'loading_voices',
        'playing',
        'paused',
        'ended',
        'stopped',
        'error',
      ]
      for (const s of states) {
        const outgoing = TRANSITIONS[s]
        expect(Object.keys(outgoing).length).toBeGreaterThan(0)
      }
    })

    it('terminal states (ended/stopped/error) solo aceptan PLAY (+ STOP en error)', () => {
      expect(Object.keys(TRANSITIONS.ended).sort()).toEqual(['PLAY'])
      expect(Object.keys(TRANSITIONS.stopped).sort()).toEqual(['PLAY'])
      expect(Object.keys(TRANSITIONS.error).sort()).toEqual(['PLAY', 'STOP'])
    })
  })

  describe('ciclo de vida típico — play, pause, resume, end', () => {
    it('idle → playing → paused → playing → ended', () => {
      const events: TTSEvent[] = [
        { type: 'PLAY' },
        { type: 'PAUSE' },
        { type: 'RESUME' },
        { type: 'NATURAL_END' },
      ]
      let state: TTSState = 'idle'
      const expected: TTSState[] = ['playing', 'paused', 'playing', 'ended']
      for (let i = 0; i < events.length; i++) {
        const next = transition(state, events[i])
        expect(next).toBe(expected[i])
        state = next!
      }
    })

    it('idle → playing → stopped → playing (reinicio limpio)', () => {
      let state: TTSState = 'idle'
      state = transition(state, { type: 'PLAY' })!
      expect(state).toBe('playing')
      state = transition(state, { type: 'STOP' })!
      expect(state).toBe('stopped')
      state = transition(state, { type: 'PLAY' })!
      expect(state).toBe('playing')
    })
  })
})
