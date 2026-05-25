'use client'
// components/ArticleTTS.tsx — Botón "Escuchar" para leyes del temario.
//
// Recibe el array de artículos crudo y construye internamente sections para
// el engine TTS. Cuando arranca la reproducción se monta un
// TTSFloatingPlayer global (portal a <body>) con todos los controles
// (prev/next artículo, restart, drag-seek, X cierra).
//
// La capa de UI es delgada: toda la lógica vive en `lib/tts/*`.
// La sesión TTS persiste localStorage de rate + voiceURI.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTTS } from '@/lib/tts/useTTS'
import { ChainModeToggle, useTTSChain } from '@/components/tts/TTSChainContext'
import { TTSFloatingPlayer } from '@/components/tts/TTSFloatingPlayer'
import type { TTSSection } from '@/lib/tts/types'

interface ArticleLike {
  articleNumber: string
  title?: string | null
  content: string | null
}

interface ArticleTTSProps {
  /** Array de artículos. Cada artículo con `content` se convierte en una sección. */
  articles: ArticleLike[]
  /** Nombre de la ley para mostrar al usuario y para telemetría. */
  lawName?: string
}

const RATE_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5]
const TTS_RATE_STORAGE_KEY = 'vence_tts_rate'
const TTS_VOICE_STORAGE_KEY = 'vence_tts_voice_uri'

export default function ArticleTTS({ articles, lawName }: ArticleTTSProps) {
  const chain = useTTSChain()
  const componentIdRef = useRef<string>('')
  if (componentIdRef.current === '') {
    componentIdRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tts-${Math.random().toString(36).slice(2)}-${Date.now()}`
  }

  // Construir sections desde articles. Filtramos los sin contenido para no
  // generar utterances vacíos que disparan natural_end inmediato.
  const sections: TTSSection[] = useMemo(() => {
    return articles
      .filter((a) => a.content && a.content.trim().length > 0)
      .map((a) => ({
        id: a.articleNumber,
        label: a.title
          ? `Artículo ${a.articleNumber} — ${a.title}`
          : `Artículo ${a.articleNumber}`,
        text: `Artículo ${a.articleNumber}. ${a.content}`,
      }))
  }, [articles])

  const [rate, setRate] = useState(1.0)
  const [voiceURI, setVoiceURI] = useState<string | null>(null)
  const [showDiag, setShowDiag] = useState(false)

  // Hidratar rate + voiceURI desde localStorage en mount.
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem(TTS_RATE_STORAGE_KEY)
      if (savedRate) {
        const n = parseFloat(savedRate)
        if (RATE_OPTIONS.includes(n)) setRate(n)
      }
      const savedVoice = localStorage.getItem(TTS_VOICE_STORAGE_KEY)
      if (savedVoice) setVoiceURI(savedVoice)
    } catch {
      /* Safari private mode */
    }
  }, [])

  const chainNotifyRef = useRef<((id: string) => void) | null>(null)
  useEffect(() => {
    chainNotifyRef.current = chain?.notifyEnded ?? null
  }, [chain])

  const tts = useTTS({
    onNaturalEnd: () => {
      chainNotifyRef.current?.(componentIdRef.current)
    },
  })

  // Destructuramos para deps estables (cada función es useCallback con deps []).
  const {
    setRate: ttsSetRate,
    setVoice: ttsSetVoice,
    play: ttsPlay,
    pause: ttsPause,
    resume: ttsResume,
    stop: ttsStop,
    nextSection,
    previousSection,
    restartLaw,
    seekPercent,
  } = tts

  useEffect(() => {
    ttsSetRate(rate)
  }, [rate, ttsSetRate])

  useEffect(() => {
    ttsSetVoice(voiceURI)
  }, [voiceURI, ttsSetVoice])

  const play = useCallback(() => {
    ttsPlay({ sections, rate, voiceURI, lawName })
  }, [ttsPlay, sections, rate, voiceURI, lawName])

  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  }, [play])

  // Registrar la instancia con el chain.
  useEffect(() => {
    if (!chain) return
    return chain.register(componentIdRef.current, () => playRef.current())
  }, [chain])

  if (!tts.supported || sections.length === 0) return null

  const { state, canResume, voices, voicesTotal } = tts
  const isActivelyPlaying = state === 'playing' || state === 'loading_voices'
  const isPausedNow = state === 'paused'
  const showInline = !isActivelyPlaying && !isPausedNow
  const isFirstInChain = chain?.firstId === componentIdRef.current

  const handlePlayClick = () => {
    if (voices.length === 0) {
      setShowDiag(true)
      return
    }
    setShowDiag(false)
    play()
  }

  const handlePlayPauseFloating = () => {
    if (isPausedNow) {
      ttsResume()
    } else {
      ttsPause()
    }
  }

  const handleRateChange = (newRate: number) => {
    setRate(newRate)
    try {
      localStorage.setItem(TTS_RATE_STORAGE_KEY, String(newRate))
    } catch {
      /* Safari private mode */
    }
  }

  const handleVoiceChange = (newVoice: string | null) => {
    setVoiceURI(newVoice)
    try {
      if (newVoice) {
        localStorage.setItem(TTS_VOICE_STORAGE_KEY, newVoice)
      } else {
        localStorage.removeItem(TTS_VOICE_STORAGE_KEY)
      }
    } catch {
      /* Safari private mode */
    }
  }

  const primaryLabel = canResume ? 'Continuar' : 'Escuchar'

  return (
    <div className="no-print">
      {isFirstInChain && (
        <div className="mb-2">
          <ChainModeToggle />
        </div>
      )}
      {showInline && (
        <div className="inline-flex items-center gap-1">
          <button
            onClick={handlePlayClick}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
            title={`${primaryLabel} ${lawName || ''}`}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
            {primaryLabel}
          </button>
          <button
            onClick={() => setShowDiag((v) => !v)}
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
        </div>
      )}

      {/* Player flotante en portal — solo el componente activo lo renderiza,
          porque visibilidad depende del state de su propio engine. */}
      <TTSFloatingPlayer
        state={state}
        progress={tts.progress}
        currentSection={tts.currentSection}
        lawName={tts.lawName}
        rate={rate}
        rateOptions={RATE_OPTIONS}
        onRateChange={handleRateChange}
        onPlayPause={handlePlayPauseFloating}
        onStop={ttsStop}
        onNextSection={nextSection}
        onPreviousSection={previousSection}
        onRestartLaw={restartLaw}
        onSeek={seekPercent}
      />

      {showDiag && showInline && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-gray-700 dark:text-gray-300">Configuración de voz</div>

          {voices.length > 0 ? (
            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">
                Voz ({voices.length} disponibles):
              </label>
              <select
                value={voiceURI || ''}
                onChange={(e) => handleVoiceChange(e.target.value || null)}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                <option value="">Automática (mejor disponible)</option>
                {voices.map((v) => (
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

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            Voces totales: {voicesTotal} · Voces en español: {voices.length}
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
