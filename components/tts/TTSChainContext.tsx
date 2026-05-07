'use client'
// components/tts/TTSChainContext.tsx
// Contexto compartido para coordinar varias instancias de ArticleTTS dentro
// de un mismo tema (temario). Permite que al terminar la ley actual se inicie
// automáticamente la siguiente, en modo "todo el tema". Persiste la elección
// del modo (single/topic) en localStorage.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type ChainMode = 'single' | 'topic'
const TTS_MODE_STORAGE_KEY = 'vence_tts_mode'

interface ChainEntry {
  domOrder: number
  startPlay: () => void
}

interface TTSChainContextValue {
  mode: ChainMode
  setMode: (m: ChainMode) => void
  register: (id: string, startPlay: () => void) => () => void
  notifyEnded: (id: string) => void
  /** Si true, oculta el toggle (solo 0/1 ley → no tiene sentido) */
  isSingletonTopic: boolean
  /** ID del primer <ArticleTTS> registrado (por orden DOM). Sólo este renderiza el toggle. */
  firstId: string | null
}

const TTSChainContext = createContext<TTSChainContextValue | null>(null)

export function TTSChainProvider({ children }: { children: ReactNode }) {
  // Default 'topic' por UX: el contexto es "temario", lo natural es leer todo.
  const [mode, setModeState] = useState<ChainMode>('topic')
  const entriesRef = useRef<Map<string, ChainEntry>>(new Map())
  const orderCounterRef = useRef(0)
  const modeRef = useRef<ChainMode>('topic')
  const [registeredCount, setRegisteredCount] = useState(0)
  const [firstId, setFirstId] = useState<string | null>(null)

  useEffect(() => { modeRef.current = mode }, [mode])

  // Hidratar desde localStorage en mount (no en useState init para evitar
  // hydration mismatch SSR/CSR).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TTS_MODE_STORAGE_KEY)
      if (saved === 'single' || saved === 'topic') setModeState(saved)
    } catch { /* Safari private mode */ }
  }, [])

  const setMode = useCallback((m: ChainMode) => {
    setModeState(m)
    try { localStorage.setItem(TTS_MODE_STORAGE_KEY, m) } catch {}
  }, [])

  /** Recalcula firstId tomando la entry con menor domOrder. */
  const recomputeFirst = useCallback(() => {
    let lowestId: string | null = null
    let lowestOrder = Infinity
    for (const [k, v] of entriesRef.current) {
      if (v.domOrder < lowestOrder) {
        lowestOrder = v.domOrder
        lowestId = k
      }
    }
    setFirstId(lowestId)
  }, [])

  const register = useCallback((id: string, startPlay: () => void) => {
    const order = orderCounterRef.current++
    entriesRef.current.set(id, { domOrder: order, startPlay })
    setRegisteredCount(entriesRef.current.size)
    recomputeFirst()
    return () => {
      entriesRef.current.delete(id)
      setRegisteredCount(entriesRef.current.size)
      recomputeFirst()
    }
  }, [recomputeFirst])

  // notifyEnded estable (lee mode vía ref) → no fuerza re-renders al cambiar mode
  const notifyEnded = useCallback((id: string) => {
    if (modeRef.current !== 'topic') return
    const entries = Array.from(entriesRef.current.entries())
      .sort((a, b) => a[1].domOrder - b[1].domOrder)
    const idx = entries.findIndex(([k]) => k === id)
    if (idx >= 0 && idx < entries.length - 1) {
      entries[idx + 1][1].startPlay()
    }
  }, [])

  return (
    <TTSChainContext.Provider
      value={{
        mode,
        setMode,
        register,
        notifyEnded,
        isSingletonTopic: registeredCount <= 1,
        firstId,
      }}
    >
      {children}
    </TTSChainContext.Provider>
  )
}

export function useTTSChain(): TTSChainContextValue | null {
  return useContext(TTSChainContext)
}

/** Toggle "Esta ley | Todo el tema" para mostrar al inicio del tema. */
export function ChainModeToggle({ className = '' }: { className?: string }) {
  const chain = useTTSChain()
  if (!chain || chain.isSingletonTopic) return null

  return (
    <div
      className={`inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5 ${className}`}
      role="group"
      aria-label="Modo de lectura"
    >
      <button
        type="button"
        onClick={() => chain.setMode('single')}
        aria-pressed={chain.mode === 'single'}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          chain.mode === 'single'
            ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Esta ley
      </button>
      <button
        type="button"
        onClick={() => chain.setMode('topic')}
        aria-pressed={chain.mode === 'topic'}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          chain.mode === 'topic'
            ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        Todo el tema
      </button>
    </div>
  )
}
