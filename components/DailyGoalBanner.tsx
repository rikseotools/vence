// components/DailyGoalBanner.tsx
// Indicador de meta diaria en el Header para usuarios premium
'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDailyGoal } from '../hooks/useDailyGoal'

export default function DailyGoalBanner() {
  const { user, isPremium, userProfile } = useAuth() as any
  const { questionsToday, studyGoal, goalReached, recordAnswerForGoal } = useDailyGoal()
  const [dismissed, setDismissed] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isDefaultGoal = !userProfile?.study_goal || userProfile.study_goal === 25
  const needsSetup = isDefaultGoal

  // Check dismiss state
  useEffect(() => {
    if (!user) return
    try {
      const dismissedForever = localStorage.getItem(`daily_goal_dismissed_${user.id}`) === '1'
      if (dismissedForever) { setDismissed(true); return }
      setDismissed(false)
    } catch {
      setDismissed(false)
    }
  }, [user])

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

  if (!user || !isPremium || dismissed) return null

  const progress = studyGoal > 0 ? Math.min((questionsToday / studyGoal) * 100, 100) : 0

  const handleDismissForever = () => {
    setDismissed(true)
    setShowDropdown(false)
    try {
      localStorage.setItem(`daily_goal_dismissed_${user.id}`, '1')
    } catch { /* ignore */ }
  }

  const handleSaveGoal = async () => {
    const goal = parseInt(newGoal)
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
      {/* Header button — small pill */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          goalReached
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
            : needsSetup
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}
        title="Meta diaria"
      >
        {goalReached ? (
          <>&#127942; {questionsToday}/{studyGoal}</>
        ) : needsSetup ? (
          <>&#127919; Meta</>
        ) : (
          <>&#127919; {questionsToday}/{studyGoal}</>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
          {needsSetup && !editing ? (
            <>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                Configura tu meta diaria
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Elige cuantas preguntas quieres responder cada dia para mantener tu ritmo de estudio.
              </div>
              <div className="flex gap-2 mb-2">
                {[25, 50, 100, 200].map(n => (
                  <button
                    key={n}
                    onClick={() => { setNewGoal(String(n)); setEditing(true) }}
                    className="flex-1 text-sm py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors font-medium"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setNewGoal(''); setEditing(true) }}
                className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-1"
              >
                Otro numero...
              </button>
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
              <button
                onClick={handleDismissForever}
                className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 py-1"
              >
                En otro momento
              </button>
            </>
          ) : editing ? (
            <>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Meta diaria (preguntas)
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
                  placeholder="Ej: 50"
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveGoal}
                  disabled={saving || !newGoal}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '...' : 'Guardar'}
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
            /* Progress view (goal is set) */
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
                onClick={() => { setNewGoal(String(studyGoal)); setEditing(true) }}
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
