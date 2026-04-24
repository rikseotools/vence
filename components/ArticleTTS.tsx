'use client'
// components/ArticleTTS.tsx — Botón "Escuchar" para leyes del temario
// Usa Web Speech Synthesis API (nativa del navegador, sin coste).
// Divide texto largo en chunks para evitar el bug de Chrome que
// descarta silenciosamente utterances muy largas.
//
// Robustez:
// - Chunks de 250 chars (Chrome descarta utterances largas)
// - KeepAlive: pause+resume cada 10s (Chrome mata speech tras ~15s)
// - Watchdog: cada 3s verifica que sigue hablando, re-lanza si murió
// - Progreso visual: muestra chunk actual / total

import { useState, useEffect, useRef, useCallback } from 'react'

interface ArticleTTSProps {
  text: string
  articleNumber?: string
  lawName?: string
}

// Chrome limita utterances a ~200-300 chars antes de fallar silenciosamente.
const MAX_CHUNK_LENGTH = 250

function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_LENGTH && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.length > 0 ? chunks : [text]
}

export default function ArticleTTS({ text, articleNumber, lawName }: ArticleTTSProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [rate, setRate] = useState(1.0)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const chunksRef = useRef<string[]>([])
  const currentChunkRef = useRef(0)
  const stoppedRef = useRef(false)
  const playingRef = useRef(false) // mirror of isPlaying for timers
  const pausedRef = useRef(false)  // mirror of isPaused for timers

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setIsSupported(true)

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) setVoicesLoaded(true)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
      if (keepAliveRef.current) clearInterval(keepAliveRef.current)
      if (watchdogRef.current) clearInterval(watchdogRef.current)
    }
  }, [])

  // Strip markdown for cleaner speech
  const cleanText = useCallback((raw: string): string => {
    return raw
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/>\s?/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()
  }, [])

  const getSpanishVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices()
    return voices.find(v => v.lang === 'es-ES' && v.name.includes('Google'))
      || voices.find(v => v.lang === 'es-ES')
      || voices.find(v => v.lang.startsWith('es'))
      || null
  }, [])

  // ── KeepAlive: pause+resume cada 10s para evitar que Chrome mate el speech ──
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const startKeepAlive = useCallback(() => {
    stopKeepAlive()
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10_000)
  }, [stopKeepAlive])

  // ── Watchdog: detecta muerte silenciosa y re-lanza el chunk actual ──
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  // speakChunk necesita ser estable para que el watchdog lo llame.
  // Usamos un ref para la función actual.
  const speakChunkRef = useRef<(index: number) => void>(() => {})

  const startWatchdog = useCallback(() => {
    stopWatchdog()
    watchdogRef.current = setInterval(() => {
      // Si debería estar hablando pero no lo está → re-lanzar
      if (
        playingRef.current &&
        !pausedRef.current &&
        !stoppedRef.current &&
        !window.speechSynthesis.speaking &&
        !window.speechSynthesis.pending &&
        currentChunkRef.current < chunksRef.current.length
      ) {
        console.warn(`🔄 [TTS Watchdog] Speech murió en chunk ${currentChunkRef.current}/${chunksRef.current.length}, re-lanzando...`)
        speakChunkRef.current(currentChunkRef.current)
      }
    }, 3_000)
  }, [stopWatchdog])

  const stopAllTimers = useCallback(() => {
    stopKeepAlive()
    stopWatchdog()
  }, [stopKeepAlive, stopWatchdog])

  const speakChunk = useCallback((index: number) => {
    if (stoppedRef.current || index >= chunksRef.current.length) {
      setIsPlaying(false)
      playingRef.current = false
      setIsPaused(false)
      pausedRef.current = false
      stopAllTimers()
      setProgress({ current: chunksRef.current.length, total: chunksRef.current.length })
      return
    }

    currentChunkRef.current = index
    setProgress({ current: index + 1, total: chunksRef.current.length })

    const utterance = new SpeechSynthesisUtterance(chunksRef.current[index])
    utterance.lang = 'es-ES'
    utterance.rate = rate

    const voice = getSpanishVoice()
    if (voice) utterance.voice = voice

    utterance.onend = () => {
      if (!stoppedRef.current) {
        speakChunk(index + 1)
      }
    }
    utterance.onerror = (e) => {
      // 'interrupted' is normal when stopping/pausing or keepalive
      if (e.error !== 'interrupted' && !stoppedRef.current) {
        speakChunk(index + 1)
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [rate, getSpanishVoice, stopAllTimers])

  // Keep speakChunkRef in sync for the watchdog
  useEffect(() => {
    speakChunkRef.current = speakChunk
  }, [speakChunk])

  const play = useCallback(() => {
    if (!isSupported || !text) return

    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
      pausedRef.current = false
      setIsPlaying(true)
      playingRef.current = true
      startKeepAlive()
      startWatchdog()
      return
    }

    window.speechSynthesis.cancel()
    stoppedRef.current = false

    const cleaned = cleanText(text)
    chunksRef.current = splitIntoChunks(cleaned)
    currentChunkRef.current = 0

    setIsPlaying(true)
    playingRef.current = true
    setIsPaused(false)
    pausedRef.current = false
    setProgress({ current: 1, total: chunksRef.current.length })
    speakChunk(0)
    startKeepAlive()
    startWatchdog()
  }, [isSupported, text, isPaused, cleanText, speakChunk, startKeepAlive, startWatchdog])

  const pause = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.pause()
    stopAllTimers()
    setIsPaused(true)
    pausedRef.current = true
    setIsPlaying(false)
    playingRef.current = false
  }, [isSupported, stopAllTimers])

  const stop = useCallback(() => {
    if (!isSupported) return
    stoppedRef.current = true
    window.speechSynthesis.cancel()
    stopAllTimers()
    setIsPlaying(false)
    playingRef.current = false
    setIsPaused(false)
    pausedRef.current = false
  }, [isSupported, stopAllTimers])

  const changeRate = useCallback(() => {
    const rates = [1.0, 1.25, 1.5, 0.75]
    const currentIdx = rates.indexOf(rate)
    setRate(rates[(currentIdx + 1) % rates.length])
  }, [rate])

  if (!isSupported || !text) return null

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="no-print inline-flex items-center gap-1">
      {!isPlaying && !isPaused && (
        <>
          <button
            onClick={play}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
            title={`Escuchar ${lawName || ''}`}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
            Escuchar
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 hidden sm:inline">
            🔊 Aprovecha el transporte, conducción, gimnasio, paseos, deporte y rutinas diarias para escuchar las leyes — todo suma
          </span>
        </>
      )}

      {(isPlaying || isPaused) && (
        <>
          {isPlaying ? (
            <button
              onClick={pause}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded transition-colors"
              title="Pausar"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pausar
            </button>
          ) : (
            <button
              onClick={play}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded transition-colors"
              title="Continuar"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              Continuar
            </button>
          )}
          <button
            onClick={stop}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
            title="Parar"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={changeRate}
            className="inline-flex items-center px-1.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cambiar velocidad"
          >
            {rate}x
          </button>
          {/* Progreso */}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 tabular-nums">
            {progressPercent}%
          </span>
        </>
      )}
    </div>
  )
}
