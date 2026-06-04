// components/DailyGoalBanner.tsx
// Indicador de meta diaria en el Header para usuarios premium
// Siempre muestra barra de progreso. Click abre dropdown para cambiar meta. Confetti al completar.
'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDailyGoal } from '../hooks/useDailyGoal'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { emitClientEvent } from '../lib/observability/client'

// ============================================================================
// Helpers puros (testeados en __tests__/components/DailyGoalBanner.test.ts).
// La lógica de negocio vive aquí fuera del componente para poder testearla sin
// montar React (mismo patrón que QuestionEvolution).
// ============================================================================

/**
 * Visibilidad efectiva de la barra a partir de la preferencia de cuenta.
 * Default = visible: sólo se oculta si el flag es explícitamente `false`
 * (null/undefined = aún no cargado o sin preferencia → visible).
 */
export function effectiveBannerVisible(flag: boolean | null | undefined): boolean {
  return flag !== false
}

/** Valor siguiente al pulsar el toggle (invierte el estado efectivo actual). */
export function nextBannerVisible(currentEffective: boolean): boolean {
  return !currentEffective
}

/**
 * Clampea el desplazamiento de arrastre para que la barra NUNCA se pierda fuera
 * del viewport (queda siempre completamente visible con un margen). Devuelve el
 * offset (relativo a la posición natural) ya corregido. Pura: sin DOM ni window.
 */
export function clampBannerOffset(args: {
  naturalLeft: number
  naturalTop: number
  baseX: number
  baseY: number
  dx: number
  dy: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
}): { x: number; y: number } {
  const m = args.margin ?? 4
  let absLeft = args.naturalLeft + args.baseX + args.dx
  let absTop = args.naturalTop + args.baseY + args.dy
  absLeft = Math.min(Math.max(absLeft, m), args.viewportWidth - args.width - m)
  absTop = Math.min(Math.max(absTop, m), args.viewportHeight - args.height - m)
  return {
    x: Math.round(absLeft - args.naturalLeft),
    y: Math.round(absTop - args.naturalTop),
  }
}

export default function DailyGoalBanner() {
  const { user, isPremium, userProfile } = useAuth() as any
  const {
    questionsToday, studyGoal, goalReached, justReachedGoal,
    dismissGoalCelebration, loading: goalLoading,
  } = useDailyGoal()
  const [showDropdown, setShowDropdown] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const confettiFiredRef = useRef(false)
  // Barra movible + ocultable: en móvil vive en la fila flotante `absolute top-full`
  // del Header y tapaba contenido. La X la oculta (persistido por dispositivo) y se
  // puede arrastrar a otro sitio (posición persistida). Ambos por-usuario en localStorage.
  const [hidden, setHidden] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Visibilidad = preferencia de CUENTA (fuente de verdad: user_profiles.show_daily_goal_banner).
  // No es localStorage por-dispositivo: ocultarla con la X se ve en todos los
  // dispositivos y se refleja como toggle en /perfil; sólo se re-activa allí.
  useEffect(() => {
    if (!userProfile) return
    setHidden(!effectiveBannerVisible(userProfile.show_daily_goal_banner))
  }, [userProfile?.show_daily_goal_banner, userProfile])

  // La POSICIÓN sí es per-dispositivo (depende del tamaño de pantalla) → localStorage.
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(`daily_goal_pos:${user.id}`)
      setPos(raw ? JSON.parse(raw) : null)
    } catch { /* ignore */ }
  }, [user?.id])

  // Re-clampea la posición guardada al viewport ACTUAL (al montar y al
  // redimensionar/rotar). Sin esto, una posición guardada en pantalla ancha
  // podría dejar la barra fuera de pantalla o tapando contenido en una estrecha
  // — justo lo que esta feature pretende evitar. Idempotente (si ya cabe,
  // devuelve el mismo objeto → no re-renderiza ni hace bucle).
  useEffect(() => {
    if (hidden || !pos) return
    const reclamp = () => setPos(prev => {
      const wrapper = dropdownRef.current
      if (!prev || !wrapper) return prev
      const rect = wrapper.getBoundingClientRect()
      const next = clampBannerOffset({
        naturalLeft: rect.left - prev.x, naturalTop: rect.top - prev.y,
        baseX: prev.x, baseY: prev.y, dx: 0, dy: 0,
        width: rect.width, height: rect.height,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      })
      if (next.x === prev.x && next.y === prev.y) return prev
      try { localStorage.setItem(`daily_goal_pos:${user.id}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    reclamp()
    window.addEventListener('resize', reclamp)
    return () => window.removeEventListener('resize', reclamp)
  }, [hidden, pos, user?.id])

  // Fire confetti from the pill position, multiple bursts over 3 seconds
  const fireConfetti = () => {
    if (confettiFiredRef.current) return
    confettiFiredRef.current = true
    try {
      const key = `daily_goal_confetti_${user?.id}_${new Date().toISOString().slice(0, 10)}`
      localStorage.setItem(key, '1')
    } catch { /* ignore */ }

    // Calculate origin from pill button position
    const rect = buttonRef.current?.getBoundingClientRect()
    const originX = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.7
    const originY = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.05

    import('canvas-confetti').then(({ default: confetti }) => {
      const origin = { x: originX, y: originY }
      // Burst 1
      confetti({ particleCount: 40, spread: 70, startVelocity: 25, ticks: 80, zIndex: 9999, origin })
      // Burst 2
      setTimeout(() => {
        confetti({ particleCount: 30, spread: 90, startVelocity: 20, ticks: 80, zIndex: 9999, origin })
      }, 500)
      // Burst 3
      setTimeout(() => {
        confetti({ particleCount: 35, spread: 100, startVelocity: 30, ticks: 80, zIndex: 9999, origin })
      }, 1200)
      // Burst 4
      setTimeout(() => {
        confetti({ particleCount: 25, spread: 60, startVelocity: 15, ticks: 80, zIndex: 9999, origin })
      }, 2000)
      // Burst 5 (final)
      setTimeout(() => {
        confetti({ particleCount: 50, spread: 120, startVelocity: 35, ticks: 100, zIndex: 9999, origin })
      }, 2700)
    }).catch(() => {})
  }

  // Confetti: al alcanzar meta en tiempo real
  useEffect(() => {
    if (!justReachedGoal) return
    fireConfetti()
    const timer = setTimeout(dismissGoalCelebration, 3000)
    return () => clearTimeout(timer)
  }, [justReachedGoal, dismissGoalCelebration])

  // Confetti: al cargar si ya superó meta y no se celebró hoy
  useEffect(() => {
    if (goalLoading || !goalReached || !user) return
    try {
      const key = `daily_goal_confetti_${user.id}_${new Date().toISOString().slice(0, 10)}`
      if (localStorage.getItem(key) === '1') {
        confettiFiredRef.current = true
        return
      }
    } catch { /* ignore */ }
    // Small delay for the page to render
    const timer = setTimeout(fireConfetti, 1000)
    return () => clearTimeout(timer)
  }, [goalLoading, goalReached, user])

  if (!user || !isPremium || goalLoading) return null
  if (hidden) return null

  const progress = studyGoal > 0 ? Math.round((questionsToday / studyGoal) * 100) : 0

  // Ocultar = preferencia de cuenta (PUT). Optimista en local + dispatch
  // 'profileUpdated' para que AuthContext recargue y todo quede coherente.
  // Sólo se re-activa desde el toggle de /perfil.
  const hidePill = async () => {
    setHidden(true)
    setShowDropdown(false)
    emitClientEvent({ severity: 'info', eventType: 'daily_goal_banner_action', metadata: { action: 'hide' } })
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, data: { showDailyGoalBanner: false } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      window.dispatchEvent(new CustomEvent('profileUpdated'))
    } catch (err) {
      // El PUT falló: la ✕ era optimista → revertimos para no dejar una
      // inconsistencia silenciosa (oculta en local pero reaparece al recargar).
      setHidden(false)
      const message = err instanceof Error ? err.message : 'unknown'
      console.warn('Error ocultando barra de meta:', message)
      emitClientEvent({
        severity: 'warn',
        eventType: 'daily_goal_banner_action',
        errorMessage: `hide PUT failed: ${message}`,
        metadata: { action: 'hide_failed' },
      })
    }
  }

  // Arrastre (pointer events → mouse + touch). Distingue click de drag por umbral (6px)
  // para no romper la apertura del dropdown. Clampea al viewport: nunca se pierde fuera.
  const onPillPointerDown = (e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return
    const wrapper = dropdownRef.current
    if (!wrapper) return
    const base = pos ?? { x: 0, y: 0 }
    const rect = wrapper.getBoundingClientRect()
    const naturalLeft = rect.left - base.x
    const naturalTop = rect.top - base.y
    const w = rect.width
    const h = rect.height
    const startX = e.clientX
    const startY = e.clientY
    let latest = base
    movedRef.current = false

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!movedRef.current && Math.hypot(dx, dy) < 6) return
      movedRef.current = true
      latest = clampBannerOffset({
        naturalLeft, naturalTop, baseX: base.x, baseY: base.y, dx, dy,
        width: w, height: h, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      })
      setPos(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (movedRef.current) {
        try { localStorage.setItem(`daily_goal_pos:${user.id}`, JSON.stringify(latest)) } catch { /* ignore */ }
        emitClientEvent({ severity: 'info', eventType: 'daily_goal_banner_action', metadata: { action: 'drag', x: latest.x, y: latest.y } })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const saveGoalValue = async (goal: number) => {
    if (isNaN(goal) || goal < 1) return
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, data: { studyGoal: goal } })
      })
      window.dispatchEvent(new CustomEvent('profileUpdated'))
      setEditing(false)
      setShowDropdown(false)
    } catch (err) {
      console.warn('Error guardando meta:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="relative"
      ref={dropdownRef}
      style={pos ? { transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 50 } : undefined}
    >
      {/* Botón X: ocultar permanentemente (en móvil tapaba contenido). Persistido por dispositivo. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); hidePill() }}
        className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 dark:bg-gray-600 text-white text-[11px] leading-none hover:bg-red-500 transition-colors"
        aria-label="Ocultar meta diaria"
        title="Ocultar meta diaria"
      >
        ×
      </button>
      {/* Pill: siempre barra de progreso. Arrastrable para moverla de sitio. */}
      <button
        ref={buttonRef}
        onPointerDown={onPillPointerDown}
        onClick={() => {
          if (movedRef.current) { movedRef.current = false; return }
          setShowDropdown(!showDropdown)
        }}
        style={{ touchAction: 'none' }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none"
        title={`Meta diaria: ${questionsToday}/${studyGoal} preguntas (${Math.round(progress)}%) · arrastra para mover`}
      >
        <div className="w-14 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              goalReached
                ? 'bg-green-500'
                : progress >= 75
                  ? 'bg-blue-500'
                  : progress >= 50
                    ? 'bg-yellow-500'
                    : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className={`tabular-nums whitespace-nowrap ${
          goalReached
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {questionsToday}/{studyGoal} ({Math.round(progress)}%)
        </span>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
          {editing ? (
            <>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Cambiar meta diaria
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[25, 50, 75, 100, 150, 200, 300, 500].map(n => (
                  <button
                    key={n}
                    onClick={() => saveGoalValue(n)}
                    disabled={saving}
                    className={`text-sm py-1.5 rounded-lg transition-colors font-medium ${
                      n === studyGoal
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newGoal && saveGoalValue(parseInt(newGoal))}
                  placeholder="Otro..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => newGoal && saveGoalValue(parseInt(newGoal))}
                  disabled={saving || !newGoal}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  OK
                </button>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="w-full text-xs text-gray-400 mt-2 hover:text-gray-600"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Meta diaria
                </span>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {questionsToday} / {studyGoal}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    goalReached ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {goalReached ? (
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Meta cumplida hoy
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Faltan {studyGoal - questionsToday} preguntas
                </div>
              )}
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => { setNewGoal(''); setEditing(true) }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Cambiar meta
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
