'use client'
// components/ArticleTTS.tsx — Botón "Escuchar" para leyes del temario
// Usa Web Speech Synthesis API (nativa del navegador, sin coste).
// Divide texto largo en chunks para evitar el bug de Chrome que
// descarta silenciosamente utterances muy largas.

import { useState, useEffect, useRef, useCallback } from 'react'

interface ArticleTTSProps {
  text: string
  articleNumber?: string
  lawName?: string
}

// Chrome limita utterances a ~200-300 chars antes de fallar silenciosamente.
// Dividimos por frases/párrafos para garantizar que se reproduzca.
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
  const chunksRef = useRef<string[]>([])
  const currentChunkRef = useRef(0)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setIsSupported(true)

    // Chrome loads voices asynchronously
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

  // Chrome bug: speechSynthesis se "duerme" después de ~15s y deja de hablar.
  // Workaround: pause+resume cada 10s para mantenerlo vivo.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startKeepAlive = useCallback(() => {
    stopKeepAlive()
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10_000)
  }, [])

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const speakChunk = useCallback((index: number) => {
    if (stoppedRef.current || index >= chunksRef.current.length) {
      setIsPlaying(false)
      setIsPaused(false)
      stopKeepAlive()
      return
    }

    currentChunkRef.current = index
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
  }, [rate, getSpanishVoice, stopKeepAlive])

  const play = useCallback(() => {
    if (!isSupported || !text) return

    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
      setIsPlaying(true)
      startKeepAlive()
      return
    }

    window.speechSynthesis.cancel()
    stoppedRef.current = false

    const cleaned = cleanText(text)
    chunksRef.current = splitIntoChunks(cleaned)
    currentChunkRef.current = 0

    setIsPlaying(true)
    setIsPaused(false)
    speakChunk(0)
    startKeepAlive()
  }, [isSupported, text, isPaused, cleanText, speakChunk, startKeepAlive])

  const pause = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.pause()
    stopKeepAlive()
    setIsPaused(true)
    setIsPlaying(false)
  }, [isSupported, stopKeepAlive])

  const stop = useCallback(() => {
    if (!isSupported) return
    stoppedRef.current = true
    window.speechSynthesis.cancel()
    stopKeepAlive()
    setIsPlaying(false)
    setIsPaused(false)
  }, [isSupported, stopKeepAlive])

  const changeRate = useCallback(() => {
    const rates = [1.0, 1.25, 1.5, 0.75]
    const currentIdx = rates.indexOf(rate)
    setRate(rates[(currentIdx + 1) % rates.length])
  }, [rate])

  if (!isSupported || !text) return null

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
        </>
      )}
    </div>
  )
}
