// lib/tts/useTTS.ts
//
// Hook React que expone el TTSEngine de forma idiomática. Una instancia
// del engine por componente. Cleanup automático en unmount.
//
// API minimal:
//   const { state, progress, play, pause, resume, stop, setRate, setVoice, voices } = useTTS({ onNaturalEnd })

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TTSEngine, type TTSEngineCallbacks, type TTSLastError } from './engine'
import type {
  TTSCurrentSection,
  TTSPlayOptions,
  TTSProgress,
  TTSState,
} from './types'

interface UseTTSReturn {
  state: TTSState
  progress: TTSProgress
  /** True si el próximo play() reanuda desde la posición guardada. */
  canResume: boolean
  /** Sección actual (artículo) — null si no hay sesión o el caller no pasó sections. */
  currentSection: TTSCurrentSection | null
  /** Nombre de la ley en curso. */
  lawName: string | null
  /** Último error fatal del motor — el UI puede mostrar mensaje (p.ej.
   *  "Tu navegador no tiene voces disponibles" cuando errorType apunta a
   *  fallo de síntesis). Null si no hay error en curso. */
  lastError: TTSLastError | null
  /** Voces ES disponibles en el dispositivo. */
  voices: SpeechSynthesisVoice[]
  /** Voces totales (para diagnóstico). */
  voicesTotal: number
  /** True si el navegador soporta Web Speech. */
  supported: boolean
  play: (options: TTSPlayOptions) => void
  pause: () => void
  resume: () => void
  stop: () => void
  setRate: (rate: number) => void
  setVoice: (voiceURI: string | null) => void
  /** Navegación por sección/artículo. */
  nextSection: () => void
  previousSection: () => void
  restartSection: () => void
  restartLaw: () => void
  /** Seek arrastrable: pct entre 0 y 1. */
  seekPercent: (pct: number) => void
}

export function useTTS(callbacks: TTSEngineCallbacks = {}): UseTTSReturn {
  const engineRef = useRef<TTSEngine | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // Crear engine UNA vez por mount, cleanup en unmount.
  if (engineRef.current === null && typeof window !== 'undefined') {
    engineRef.current = new TTSEngine({
      onNaturalEnd: () => callbacksRef.current.onNaturalEnd?.(),
    })
  }

  const [snapshot, setSnapshot] = useState(() =>
    engineRef.current?.getSnapshot() ?? {
      state: 'idle' as TTSState,
      progress: { currentChunk: 0, totalChunks: 0, percent: 0 },
      canResume: false,
      currentSection: null,
      lawName: null,
      lastError: null,
    },
  )

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voicesTotal, setVoicesTotal] = useState(0)
  const [supported, setSupported] = useState(false)

  // Suscripción al engine
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const unsubscribe = engine.subscribe(setSnapshot)
    return () => {
      unsubscribe()
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  // Cargar voces + reactivamente actualizar cuando voiceschanged dispara
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }
    setSupported(true)
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices()
      setVoicesTotal(all.length)
      setVoices(all.filter((v) => v.lang.startsWith('es')))
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  // API estable — todos los handlers son refs sobre el engine, no cambian
  // entre renders. Esto evita re-renders cascada en ArticleTTS.
  const play = useCallback((options: TTSPlayOptions) => {
    engineRef.current?.play(options)
  }, [])

  const pause = useCallback(() => {
    engineRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    engineRef.current?.resume()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
  }, [])

  const setRate = useCallback((rate: number) => {
    engineRef.current?.setRate(rate)
  }, [])

  const setVoice = useCallback((voiceURI: string | null) => {
    engineRef.current?.setVoice(voiceURI)
  }, [])

  const nextSection = useCallback(() => {
    engineRef.current?.nextSection()
  }, [])

  const previousSection = useCallback(() => {
    engineRef.current?.previousSection()
  }, [])

  const restartSection = useCallback(() => {
    engineRef.current?.restartSection()
  }, [])

  const restartLaw = useCallback(() => {
    engineRef.current?.restartLaw()
  }, [])

  const seekPercent = useCallback((pct: number) => {
    engineRef.current?.seekPercent(pct)
  }, [])

  return {
    state: snapshot.state,
    progress: snapshot.progress,
    canResume: snapshot.canResume,
    currentSection: snapshot.currentSection,
    lawName: snapshot.lawName,
    lastError: snapshot.lastError,
    voices,
    voicesTotal,
    supported,
    play,
    pause,
    resume,
    stop,
    setRate,
    setVoice,
    nextSection,
    previousSection,
    restartSection,
    restartLaw,
    seekPercent,
  }
}
