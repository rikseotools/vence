// components/DailyGoalBanner.tsx
// Banner para usuarios premium sugiriendo configurar meta diaria + progreso
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface DailyGoalBannerProps {
  questionsToday: number
  studyGoal: number
  goalReached: boolean
}

export default function DailyGoalBanner({ questionsToday, studyGoal, goalReached }: DailyGoalBannerProps) {
  const { user, isPremium, userProfile, supabase } = useAuth() as any
  const [dismissed, setDismissed] = useState(true) // Start hidden to avoid flash
  const [editing, setEditing] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [saving, setSaving] = useState(false)

  const isDefaultGoal = !userProfile?.study_goal || userProfile.study_goal === 25
  const showSetupPrompt = isDefaultGoal && !goalReached

  useEffect(() => {
    if (!user) return
    // Check if dismissed today
    try {
      const key = `daily_goal_banner_${user.id}_${new Date().toISOString().slice(0, 10)}`
      const wasDismissed = localStorage.getItem(key) === '1'
      setDismissed(wasDismissed)
    } catch {
      setDismissed(false)
    }
  }, [user])

  if (!user || !isPremium || dismissed) return null

  const progress = studyGoal > 0 ? Math.min((questionsToday / studyGoal) * 100, 100) : 0

  const handleDismiss = () => {
    setDismissed(true)
    try {
      const key = `daily_goal_banner_${user.id}_${new Date().toISOString().slice(0, 10)}`
      localStorage.setItem(key, '1')
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
        body: JSON.stringify({
          userId: user.id,
          data: { studyGoal: goal }
        })
      })
      // Notify profile update
      window.dispatchEvent(new CustomEvent('profileUpdated'))
      setEditing(false)
    } catch (err) {
      console.warn('Error guardando meta:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-200 dark:border-blue-700 p-3 z-40">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-1.5 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
        aria-label="Cerrar"
      >
        &times;
      </button>

      {showSetupPrompt && !editing ? (
        /* Prompt to set a custom goal */
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5 pr-4">
            Configura tu meta diaria
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {questionsToday > 0
              ? `Llevas ${questionsToday} preguntas hoy.`
              : 'Establece cuantas preguntas quieres hacer al dia.'
            }
          </div>
          <button
            onClick={() => { setEditing(true); setNewGoal(String(studyGoal)) }}
            className="w-full text-sm bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Establecer meta
          </button>
        </div>
      ) : editing ? (
        /* Inline editor */
        <div>
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
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSaveGoal}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '...' : 'OK'}
            </button>
          </div>
          <div className="flex gap-2 mt-1.5">
            {[25, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => setNewGoal(String(n))}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Progress display (custom goal already set) */
        <div>
          <div className="flex justify-between items-center mb-1.5 pr-4">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Meta diaria
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {questionsToday}/{studyGoal}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                goalReached ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {goalReached && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              Meta cumplida
            </div>
          )}
        </div>
      )}
    </div>
  )
}
