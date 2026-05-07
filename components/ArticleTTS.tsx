'use client'
// components/ArticleTTS.tsx — Botón "Escuchar" para leyes del temario
// Usa Web Speech Synthesis API (nativa del navegador, sin coste).
// Divide texto largo en chunks para evitar el bug de Chrome que
// descarta silenciosamente utterances muy largas.
//
// Robustez:
// - Chunks de 250 chars (Chrome descarta utterances largas)
// - Watchdog cada 2s: detecta muerte silenciosa + chunks zombie (>30s)
// - NO usa pause()+resume() keepalive (corrompe onend en Chrome 147)
// - Progreso visual + diagnóstico de dispositivo
// - Errores del watchdog → Sentry (observable sin coste de BD)

import { useState, useEffect, useRef, useCallback } from 'react'
import { logClientError } from '@/lib/logClientError'
import { useTTSChain, ChainModeToggle } from '@/components/tts/TTSChainContext'

interface ArticleTTSProps {
  text: string
  articleNumber?: string
  lawName?: string
}

// Chrome limita utterances a ~200-300 chars antes de fallar silenciosamente.
const MAX_CHUNK_LENGTH = 250

const RATE_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5]
const TTS_RATE_STORAGE_KEY = 'vence_tts_rate'
const TTS_VOICE_STORAGE_KEY = 'vence_tts_voice_uri'

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
  const [showDiag, setShowDiag] = useState(false)
  const [diagInfo, setDiagInfo] = useState('')
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const chunksRef = useRef<string[]>([])
  const currentChunkRef = useRef(0)
  const stoppedRef = useRef(false)
  const playingRef = useRef(false) // mirror of isPlaying for timers
  const pausedRef = useRef(false)  // mirror of isPaused for timers
  const watchdogRetriesRef = useRef(0) // retries for current chunk
  const MAX_WATCHDOG_RETRIES = 2 // skip chunk after N failed retries

  // Rate "actualmente en uso" (el del utterance vivo). Sirve para detectar
  // si el state `rate` ha cambiado respecto al utterance en curso → entonces
  // hay que cancelar+reiniciar el chunk con el nuevo rate.
  const activeRateRef = useRef(1.0)
  // Debounce del cancel+restart en cambios rápidos de rate.
  const rateChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chain context (opcional). Si está presente, registramos esta instancia
  // para participar en lectura "todo el tema" → al terminar naturalmente
  // notificamos al chain que pase al siguiente <ArticleTTS>.
  const chain = useTTSChain()
  const componentIdRef = useRef<string>('')
  if (componentIdRef.current === '') {
    componentIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tts-${Math.random().toString(36).slice(2)}-${Date.now()}`
  }
  // Ref a notifyEnded para que speakChunk la consulte sin meterla en deps
  const chainNotifyEndedRef = useRef<((id: string) => void) | null>(null)
  useEffect(() => {
    chainNotifyEndedRef.current = chain?.notifyEnded ?? null
  }, [chain])

  // Hidratar rate y voz desde localStorage en mount (no en useState init para
  // evitar hydration mismatch SSR/CSR). Se escriben sólo en onChange, no en
  // cada render.
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem(TTS_RATE_STORAGE_KEY)
      if (savedRate) {
        const n = parseFloat(savedRate)
        if (RATE_OPTIONS.includes(n)) setRate(n)
      }
      const savedVoice = localStorage.getItem(TTS_VOICE_STORAGE_KEY)
      if (savedVoice) setSelectedVoiceURI(savedVoice)
    } catch { /* Safari private mode, ignore */ }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setIsSupported(true)

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        setVoicesLoaded(true)
        setAvailableVoices(voices.filter(v => v.lang.startsWith('es')))
      }
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
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
    // Si el usuario eligió una voz específica, usarla
    if (selectedVoiceURI) {
      const selected = voices.find(v => v.voiceURI === selectedVoiceURI)
      if (selected) return selected
    }
    return voices.find(v => v.lang === 'es-ES' && v.name.includes('Google'))
      || voices.find(v => v.lang === 'es-ES')
      || voices.find(v => v.lang.startsWith('es'))
      || null
  }, [selectedVoiceURI])

  // ── Watchdog: detecta muerte silenciosa y re-lanza el chunk actual ──
  // Estrategia: NO usamos pause()+resume() keepalive (causa pérdida de onend
  // en Chrome 147). En vez, el watchdog verifica cada 2s si el speech murió
  // y lo re-lanza. También detecta chunks "zombie" (speaking=true pero sin
  // producir sonido) via timeout de 30s por chunk.
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkStartTimeRef = useRef(0) // timestamp de cuando empezó el chunk actual
  const CHUNK_TIMEOUT_MS = 30_000 // si un chunk lleva >30s, está muerto

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  // speakChunk necesita ser estable para que el watchdog lo llame.
  const speakChunkRef = useRef<(index: number) => void>(() => {})

  const startWatchdog = useCallback(() => {
    stopWatchdog()
    watchdogRef.current = setInterval(() => {
      if (!playingRef.current || pausedRef.current || stoppedRef.current) return
      if (currentChunkRef.current >= chunksRef.current.length) return

      const now = Date.now()
      const chunkAge = now - chunkStartTimeRef.current

      // Caso 1: speech murió silenciosamente (speaking=false, pending=false)
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        watchdogRetriesRef.current++
        window.speechSynthesis.cancel()

        if (watchdogRetriesRef.current > MAX_WATCHDOG_RETRIES) {
          const reason = `Speech murió en chunk ${currentChunkRef.current}/${chunksRef.current.length}, saltando (${watchdogRetriesRef.current} retries)`
          console.warn(`⏭️ [TTS Watchdog] ${reason}`)
          logClientError('tts/watchdog', new Error(reason), { component: 'ArticleTTS', severity: 'warning' })
          watchdogRetriesRef.current = 0
          speakChunkRef.current(currentChunkRef.current + 1)
        } else {
          console.warn(`🔄 [TTS Watchdog] Speech murió en chunk ${currentChunkRef.current}, reintento ${watchdogRetriesRef.current}/${MAX_WATCHDOG_RETRIES}`)
          speakChunkRef.current(currentChunkRef.current)
        }
        return
      }

      // Caso 2: chunk zombie (speaking=true pero lleva >30s sin onend)
      if (window.speechSynthesis.speaking && chunkAge > CHUNK_TIMEOUT_MS) {
        watchdogRetriesRef.current++
        window.speechSynthesis.cancel()

        if (watchdogRetriesRef.current > MAX_WATCHDOG_RETRIES) {
          const reason = `Chunk ${currentChunkRef.current}/${chunksRef.current.length} zombie, saltando (${watchdogRetriesRef.current} retries)`
          console.warn(`⏭️ [TTS Watchdog] ${reason}`)
          logClientError('tts/watchdog', new Error(reason), { component: 'ArticleTTS', severity: 'warning' })
          watchdogRetriesRef.current = 0
          speakChunkRef.current(currentChunkRef.current + 1)
        } else {
          console.warn(`🔄 [TTS Watchdog] Chunk ${currentChunkRef.current} zombie, reintento ${watchdogRetriesRef.current}/${MAX_WATCHDOG_RETRIES}`)
          speakChunkRef.current(currentChunkRef.current)
        }
      }
    }, 2_000)
  }, [stopWatchdog])

  const stopAllTimers = useCallback(() => {
    stopWatchdog()
  }, [stopWatchdog])

  const speakChunk = useCallback((index: number) => {
    if (stoppedRef.current || index >= chunksRef.current.length) {
      const naturalEnd = !stoppedRef.current && index >= chunksRef.current.length
      setIsPlaying(false)
      playingRef.current = false
      setIsPaused(false)
      pausedRef.current = false
      stopAllTimers()
      setProgress({ current: chunksRef.current.length, total: chunksRef.current.length })
      // Si terminó naturalmente (no por stop explícito), notificar al chain
      // para que pase a la siguiente ley en modo "todo el tema". El chain
      // ignora la notificación si el modo es "single".
      if (naturalEnd) {
        chainNotifyEndedRef.current?.(componentIdRef.current)
      }
      return
    }

    currentChunkRef.current = index
    chunkStartTimeRef.current = Date.now()
    setProgress({ current: index + 1, total: chunksRef.current.length })

    const utterance = new SpeechSynthesisUtterance(chunksRef.current[index])
    utterance.lang = 'es-ES'
    utterance.rate = rate
    activeRateRef.current = rate

    const voice = getSpanishVoice()
    if (voice) utterance.voice = voice

    utterance.onend = () => {
      watchdogRetriesRef.current = 0 // reset retries on success
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

  // Cambio de rate INSTANTÁNEO durante playback. La Web Speech API no soporta
  // cambiar la velocidad de un utterance vivo → cancelamos y reiniciamos el
  // chunk actual con el nuevo rate. Pérdida máxima: 250 chars (~10s) del
  // chunk en curso. En estado "paused", no aplicamos aquí — se aplicará en
  // el resume path de play() (cancel+speakChunk en lugar de browser.resume()).
  // En estado "stopped" o no iniciado, el nuevo rate ya queda en state y se
  // usará en el siguiente play.
  useEffect(() => {
    if (rate === activeRateRef.current) return
    if (stoppedRef.current) return
    if (!playingRef.current || pausedRef.current) return

    // Cancelar timeout previo si llega otro cambio de rate antes de que
    // se aplique (debounce).
    if (rateChangeTimeoutRef.current) {
      clearTimeout(rateChangeTimeoutRef.current)
    }

    window.speechSynthesis.cancel()
    rateChangeTimeoutRef.current = setTimeout(() => {
      rateChangeTimeoutRef.current = null
      if (stoppedRef.current || pausedRef.current) return
      if (!playingRef.current) return
      speakChunkRef.current(currentChunkRef.current)
    }, 50)

    return () => {
      if (rateChangeTimeoutRef.current) {
        clearTimeout(rateChangeTimeoutRef.current)
        rateChangeTimeoutRef.current = null
      }
    }
  }, [rate])

  const getDiagnostic = useCallback((): string => {
    if (!('speechSynthesis' in window)) return 'Tu navegador no soporta lectura en voz alta.'
    const allVoices = window.speechSynthesis.getVoices()
    const esVoices = allVoices.filter(v => v.lang.startsWith('es'))
    const browser = navigator.userAgent
    const isMobile = /Android|iPhone|iPad/i.test(browser)
    const isChrome = /Chrome/i.test(browser) && !/Edge/i.test(browser)
    const isFirefox = /Firefox/i.test(browser)
    const isSafari = /Safari/i.test(browser) && !isChrome

    let info = `Voces totales: ${allVoices.length}\n`
    info += `Voces en español: ${esVoices.length}\n`
    if (esVoices.length > 0) {
      info += `Voces: ${esVoices.map(v => v.name).join(', ')}\n`
    }
    info += `Dispositivo: ${isMobile ? 'Móvil' : 'Escritorio'}\n`
    info += `Navegador: ${isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Otro'}\n`

    if (allVoices.length === 0) {
      info += '\n⚠️ No se detectan voces. Prueba a recargar la página o usar Chrome.'
    } else if (esVoices.length === 0) {
      info += '\n⚠️ No hay voces en español. Instala un paquete de idioma español en tu dispositivo.'
    }
    return info
  }, [])

  const play = useCallback(() => {
    if (!isSupported || !text) return

    if (isPaused) {
      // Si el usuario cambió el rate durante la pausa, browser.resume()
      // continuaría con el rate viejo. En su lugar, cancelamos y
      // reiniciamos el chunk actual con el nuevo rate.
      const rateChangedDuringPause = rate !== activeRateRef.current
      if (rateChangedDuringPause) {
        window.speechSynthesis.cancel()
        setIsPaused(false)
        pausedRef.current = false
        setIsPlaying(true)
        playingRef.current = true
        // Pequeño defer para asegurar que el cancel se procese
        setTimeout(() => {
          if (!stoppedRef.current && playingRef.current) {
            speakChunkRef.current(currentChunkRef.current)
          }
        }, 50)
        startWatchdog()
        return
      }

      window.speechSynthesis.resume()
      setIsPaused(false)
      pausedRef.current = false
      setIsPlaying(true)
      playingRef.current = true
      startWatchdog()
      return
    }

    // Verificar que hay voces disponibles
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) {
      setDiagInfo(getDiagnostic())
      setShowDiag(true)
      return
    }
    const esVoices = voices.filter(v => v.lang.startsWith('es'))
    if (esVoices.length === 0) {
      setDiagInfo(getDiagnostic())
      setShowDiag(true)
      return
    }

    setShowDiag(false)
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
    startWatchdog()

    // Track TTS usage (fire-and-forget)
    fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{
        eventType: 'tts_play',
        eventCategory: 'ui',
        component: 'ArticleTTS',
        action: 'play',
        label: articleNumber ? `Art. ${articleNumber} - ${lawName || ''}` : lawName || '',
        value: { chunks: chunksRef.current.length, articleNumber, lawName },
        pageUrl: window.location.pathname,
      }] }),
    }).catch(() => {})
  }, [isSupported, text, isPaused, cleanText, speakChunk, startWatchdog, getDiagnostic, articleNumber, lawName])

  // Ref a play para que el chain pueda invocarlo sin caducar el closure.
  // Necesario porque play se recrea con cada cambio de sus deps.
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play }, [play])

  // Registrar esta instancia con el chain (si existe). Cuando el modo es
  // "todo el tema" y la ley anterior termina, el chain llama a playRef.current()
  // para iniciar esta ley.
  useEffect(() => {
    if (!chain) return
    return chain.register(componentIdRef.current, () => playRef.current())
  }, [chain])

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

  if (!isSupported || !text) return null

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  // El toggle "Esta ley | Todo el tema" sólo lo renderiza la primera instancia
  // del chain (la ley más alta del DOM en el tema actual). Las demás instancias
  // del mismo tema usan el mismo modo via context.
  const isFirstInChain = chain?.firstId === componentIdRef.current

  return (
    <div className="no-print">
      {isFirstInChain && (
        <div className="mb-2">
          <ChainModeToggle />
        </div>
      )}
      <div className="inline-flex items-center gap-1">
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
            <button
              onClick={() => { setDiagInfo(getDiagnostic()); setShowDiag(!showDiag) }}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              title="Configurar voz"
            >
              <svg className="w-3.5 h-3.5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Configurar</span>
            </button>
            {!showDiag && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">
                🔊 Aprovecha el transporte, conducción, gimnasio, paseos, deporte y rutinas diarias para escuchar las leyes — todo suma
              </span>
            )}
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
            <select
              value={rate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value)
                setRate(newRate)
                try { localStorage.setItem(TTS_RATE_STORAGE_KEY, String(newRate)) } catch {}
              }}
              className="px-1.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors border-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Velocidad de lectura"
            >
              {RATE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}x</option>
              ))}
            </select>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 tabular-nums">
              {progressPercent}%
            </span>
          </>
        )}
      </div>

      {/* Panel de configuración / diagnóstico */}
      {showDiag && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-gray-700 dark:text-gray-300">Configuración de voz</div>

          {/* Selector de voz */}
          {availableVoices.length > 0 ? (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">Voz ({availableVoices.length} disponibles):</label>
              <select
                value={selectedVoiceURI || ''}
                onChange={(e) => {
                  const newVoice = e.target.value || null
                  setSelectedVoiceURI(newVoice)
                  try {
                    if (newVoice) localStorage.setItem(TTS_VOICE_STORAGE_KEY, newVoice)
                    else localStorage.removeItem(TTS_VOICE_STORAGE_KEY)
                  } catch {}
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                <option value="">Automática (mejor disponible)</option>
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-amber-600 dark:text-amber-400">
              No se detectan voces en español en tu dispositivo.
            </div>
          )}

          {/* Info del dispositivo */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 whitespace-pre-line">
            {diagInfo}
          </div>

          <button
            onClick={() => setShowDiag(false)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
