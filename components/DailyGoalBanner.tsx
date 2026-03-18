// components/DailyGoalBanner.tsx
// Indicador de meta diaria en el Header para usuarios premium
// Siempre muestra barra de progreso. Click abre dropdown para cambiar meta. Confetti al completar.
'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDailyGoal } from '../hooks/useDailyGoal'

export default function DailyGoalBanner() {
  const { user, isPremium } = useAuth() as any
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

  const progress = studyGoal > 0 ? Math.round((questionsToday / studyGoal) * 100) : 0

  const saveGoalValue = async (goal: number) => {
    if (isNaN(goal) || goal < 1) return
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="relative" ref={dropdownRef}>
      {/* Pill: siempre barra de progreso */}
      <button
        ref={buttonRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        title={`Meta diaria: ${questionsToday}/${studyGoal} preguntas (${Math.round(progress)}%)`}
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
