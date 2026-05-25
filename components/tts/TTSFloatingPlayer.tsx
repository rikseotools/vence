'use client'
// components/tts/TTSFloatingPlayer.tsx
//
// Reproductor flotante fijo en la parte inferior. Se renderiza vía portal
// directamente en <body> para que no quede atrapado en el flujo de
// scroll/overflow del temario.
//
// Visible solo cuando la sesión TTS está playing o paused. Cierra con X
// (= stop). Permite saltar al artículo siguiente/anterior, reiniciar la
// sección actual o la ley completa, y arrastrar la barra de progreso para
// seek chunk-level.
//
// Es un componente "tonto": no posee engine. Recibe estado + handlers
// desde ArticleTTS, que es quien tiene el hook useTTS().

import { useEffect, useState } from 'react'
import type { TTSCurrentSection, TTSProgress, TTSState } from '@/lib/tts/types'

interface TTSFloatingPlayerProps {
  state: TTSState
  progress: TTSProgress
  currentSection: TTSCurrentSection | null
  lawName: string | null
  rate: number
  rateOptions: number[]
  onRateChange: (rate: number) => void
  onPlayPause: () => void
  onStop: () => void
  onNextSection: () => void
  onPreviousSection: () => void
  onRestartLaw: () => void
  onSeek: (pct: number) => void
}

export function TTSFloatingPlayer({
  state,
  progress,
  currentSection,
  lawName,
  rate,
  rateOptions,
  onRateChange,
  onPlayPause,
  onStop,
  onNextSection,
  onPreviousSection,
  onRestartLaw,
  onSeek,
}: TTSFloatingPlayerProps) {
  // Render solo cuando hay audio activo o pausado. Hydration-safe: en el
  // primer render server-side el state será 'idle' siempre, así que esto
  // devuelve null sin mismatch.
  const visible = state === 'playing' || state === 'paused' || state === 'loading_voices'

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !visible) return null

  const isPaused = state === 'paused'
  const isLoading = state === 'loading_voices'
  const sectionLabel = currentSection?.label ?? lawName ?? 'Leyendo…'
  const sectionPosition =
    currentSection !== null
      ? `Artículo ${currentSection.idx + 1} / ${currentSection.total}`
      : null

  return (
    <div
      role="region"
      aria-label="Reproductor de audio del temario"
      className="no-print fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-screen-md mx-auto px-3 py-2">
        {/* Línea superior: nombre + cerrar */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {lawName ?? 'Audio'}
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {sectionLabel}
            </div>
          </div>
          {sectionPosition && (
            <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
              {sectionPosition}
            </div>
          )}
          <button
            type="button"
            onClick={onStop}
            aria-label="Cerrar reproductor"
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barra de progreso arrastrable */}
        <div className="mb-2">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress.percent * 10)}
            onChange={(e) => onSeek(parseInt(e.target.value, 10) / 1000)}
            aria-label="Buscar en el audio"
            className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
          />
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-500 tabular-nums">
            <span>
              {progress.currentChunk + 1} / {progress.totalChunks}
            </span>
            <span>{progress.percent}%</span>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRestartLaw}
              aria-label="Volver al inicio de la ley"
              title="Volver al inicio"
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zM7 10l8-5v10l-8-5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onPreviousSection}
              aria-label="Artículo anterior"
              title="Artículo anterior"
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 5a1 1 0 011-1v12a1 1 0 11-2 0V5a1 1 0 011 1zm3 5l8-5v10l-8-5z" transform="translate(0,-1)" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={onPlayPause}
            aria-label={isPaused ? 'Continuar' : 'Pausar'}
            disabled={isLoading}
            className={`flex items-center justify-center w-12 h-12 rounded-full text-white shadow-sm transition-colors ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            ) : isPaused ? (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75V3.75A.75.75 0 008.25 3h-2.5zm6 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-2.5z" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNextSection}
              aria-label="Artículo siguiente"
              title="Artículo siguiente"
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M15 5a1 1 0 011 1v10a1 1 0 11-2 0V6a1 1 0 011-1zm-3 5l-8 5V5l8 5z" />
              </svg>
            </button>
            <select
              value={rate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              aria-label="Velocidad de lectura"
              className="px-1.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors border-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {rateOptions.map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
