'use client'
// components/tts/TTSChainContext.tsx
//
// Contexto compartido que coordina varias instancias de <ArticleTTS> dentro
// del MISMO tema (temario). Cuando una ley termina natural, dispara la
// siguiente — en modo "todo el tema". Persiste la elección en localStorage.
//
// Diseño:
//   - `entriesRef` (Map) guarda quién está registrado. NO en state — no
//     queremos triggerar re-renders por mutaciones del map.
//   - El value del Provider se memoiza con `useMemo` para que las funciones
//     y el shape sean estables entre renders. Esto IMPIDE la cascada
//     unregister/re-register que sufría la versión anterior (el value se
//     recreaba cada render → todos los `useEffect([chain])` re-ejecutaban
//     → `orderCounterRef` crecía sin parar).
//   - `register`/`notifyEnded` son `useCallback` con deps `[]` — totalmente
//     estables. Acceden a state vía refs.
//   - Sólo los datos reactivos para los consumers (mode, firstId, count)
//     viven en state — y el value cambia solo cuando ellos cambian.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

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
  /** Si true, oculta el toggle (solo 0/1 ley → no tiene sentido). */
  isSingletonTopic: boolean
  /** ID de la primera entry registrada por orden DOM. Solo esta renderiza
   *  el toggle. */
  firstId: string | null
}

const TTSChainContext = createContext<TTSChainContextValue | null>(null)

export function TTSChainProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef<Map<string, ChainEntry>>(new Map())
  const orderCounterRef = useRef(0)
  const modeRef = useRef<ChainMode>('topic')

  // Reactive state — controla cuándo se recalcula el value del context.
  const [mode, setModeState] = useState<ChainMode>('topic')
  const [registeredCount, setRegisteredCount] = useState(0)
  const [firstId, setFirstId] = useState<string | null>(null)

  // modeRef mirror para que notifyEnded lo lea sin meterlo en deps.
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // Hidratar mode desde localStorage en mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TTS_MODE_STORAGE_KEY)
      if (saved === 'single' || saved === 'topic') {
        setModeState(saved)
      }
    } catch {
      /* Safari private mode */
    }
  }, [])

  const setMode = useCallback((m: ChainMode) => {
    setModeState(m)
    try {
      localStorage.setItem(TTS_MODE_STORAGE_KEY, m)
    } catch {
      /* Safari private mode */
    }
  }, [])

  /**
   * Recalcula firstId tomando la entry con menor domOrder.
   * Los `setFirstId`/`setRegisteredCount` con función updater + comparación
   * de identidad evitan re-renders si el resultado no cambia.
   * React 18+ auto-batchea las dos llamadas, así que un register/unregister
   * provoca como mucho un re-render del Provider — y el value memoizado
   * evita que los consumers (cada ArticleTTS) re-ejecuten su efecto
   * [chain] si nada material cambió.
   */
  const recomputeFirst = useCallback(() => {
    let lowestId: string | null = null
    let lowestOrder = Infinity
    for (const [k, v] of entriesRef.current) {
      if (v.domOrder < lowestOrder) {
        lowestOrder = v.domOrder
        lowestId = k
      }
    }
    setFirstId((prev) => (prev === lowestId ? prev : lowestId))
    setRegisteredCount((prev) => {
      const next = entriesRef.current.size
      return prev === next ? prev : next
    })
  }, [])

  const register = useCallback(
    (id: string, startPlay: () => void) => {
      const order = orderCounterRef.current++
      entriesRef.current.set(id, { domOrder: order, startPlay })
      recomputeFirst()
      return () => {
        entriesRef.current.delete(id)
        recomputeFirst()
      }
    },
    [recomputeFirst],
  )

  // notifyEnded estable — lee mode vía ref para no entrar en deps.
  const notifyEnded = useCallback((id: string) => {
    if (modeRef.current !== 'topic') return
    const entries = Array.from(entriesRef.current.entries()).sort(
      (a, b) => a[1].domOrder - b[1].domOrder,
    )
    const idx = entries.findIndex(([k]) => k === id)
    if (idx >= 0 && idx < entries.length - 1) {
      try {
        entries[idx + 1][1].startPlay()
      } catch {
        /* startPlay no debe romper el chain */
      }
    }
  }, [])

  const value = useMemo<TTSChainContextValue>(
    () => ({
      mode,
      setMode,
      register,
      notifyEnded,
      isSingletonTopic: registeredCount <= 1,
      firstId,
    }),
    [mode, setMode, register, notifyEnded, registeredCount, firstId],
  )

  return (
    <TTSChainContext.Provider value={value}>
      {children}
    </TTSChainContext.Provider>
  )
}

export function useTTSChain(): TTSChainContextValue | null {
  return useContext(TTSChainContext)
}

/** Toggle "Esta ley | Todo el tema" — mostrar solo en la primera ley del tema. */
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
