// components/Statistics/DifficultyBreakdown.js
'use client'

import { useState, useEffect } from 'react'
import { adaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'
import { useAuth } from '@/contexts/AuthContext'

export default function DifficultyBreakdown({ difficultyBreakdown }) {
  const { supabase } = useAuth()
  const [personalBreakdown, setPersonalBreakdown] = useState(null)
  const [showPersonal, setShowPersonal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [userDaysActive, setUserDaysActive] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Calcular días desde registro
      if (user?.created_at) {
        const createdAt = new Date(user.created_at)
        const now = new Date()
        const days = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
        setUserDaysActive(days)
      }
    }
    getUser()
  }, [supabase.auth])

  const loadPersonalBreakdown = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const breakdown = await adaptiveDifficultyService.getPersonalDifficultyBreakdown(user.id)

      const personalData = [
        {
          difficulty: 'easy',
          total: breakdown.easy,
          correct: Math.round(breakdown.easy * 0.85),
          accuracy: breakdown.easy_percentage || 0
        },
        {
          difficulty: 'medium',
          total: breakdown.medium,
          correct: Math.round(breakdown.medium * 0.70),
          accuracy: breakdown.medium_percentage || 0
        },
        {
          difficulty: 'hard',
          total: breakdown.hard,
          correct: Math.round(breakdown.hard * 0.55),
          accuracy: breakdown.hard_percentage || 0
        },
        {
          difficulty: 'extreme',
          total: breakdown.extreme,
          correct: Math.round(breakdown.extreme * 0.40),
          accuracy: breakdown.extreme_percentage || 0
        }
      ].filter(item => item.total > 0)

      setPersonalBreakdown(personalData)
    } catch (error) {
      console.error('Error loading personal breakdown:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Comparar tu precisión vs precisión esperada según dificultad global
  const getComparison = () => {
    if (!difficultyBreakdown || difficultyBreakdown.length === 0) return null

    // Precisión esperada por categoría de dificultad (basada en datos globales típicos)
    const expectedAccuracy = {
      easy: 75,    // Preguntas fáciles: ~75% acierto medio
      medium: 55,  // Preguntas medias: ~55% acierto medio
      hard: 35,    // Preguntas difíciles: ~35% acierto medio
      extreme: 20  // Preguntas muy difíciles: ~20% acierto medio
    }

    // Calcular tu precisión real y la esperada ponderada
    let totalQuestions = 0
    let totalCorrect = 0
    let expectedCorrect = 0

    difficultyBreakdown.forEach(d => {
      totalQuestions += d.total
      totalCorrect += d.correct
      expectedCorrect += d.total * (expectedAccuracy[d.difficulty] || 50) / 100
    })

    if (totalQuestions === 0) return null

    const userAccuracy = Math.round((totalCorrect / totalQuestions) * 100)
    const expectedAccuracyWeighted = Math.round((expectedCorrect / totalQuestions) * 100)
    const difference = userAccuracy - expectedAccuracyWeighted

    return {
      isBetter: difference > 5,
      isWorse: difference < -5,
      isSimilar: Math.abs(difference) <= 5,
      difference: Math.abs(difference),
      userAccuracy,
      expectedAccuracy: expectedAccuracyWeighted,
      totalQuestions,
      totalCorrect
    }
  }

  const comparison = showPersonal ? getComparison() : null

  const currentData = showPersonal ? personalBreakdown : difficultyBreakdown

  if (!difficultyBreakdown || difficultyBreakdown.length === 0) return null

  const difficultyLabels = {
    easy: 'Fácil',
    medium: 'Media',
    hard: 'Difícil',
    extreme: 'Muy difícil'
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">📊 Rendimiento por Dificultad</h3>
        {user && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPersonal(false)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                !showPersonal
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Estándar
            </button>
            <button
              onClick={() => {
                setShowPersonal(true)
                if (!personalBreakdown) loadPersonalBreakdown()
              }}
              disabled={isLoading}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                showPersonal
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Cargando...' : 'Personal'}
            </button>
          </div>
        )}
      </div>

      {/* Info visible (sin desplegable) */}
      {!showPersonal && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700">
            <strong>📊 Tus respuestas</strong> agrupadas por dificultad global (cómo de difíciles son para la media de opositores).
          </p>
          <p className="text-xs text-gray-500 mt-1">
            El % muestra tu acierto en cada categoría. Ej: &quot;Fácil 17% • 146/876&quot; = respondiste 876 preguntas fáciles, acertaste 146.
          </p>
          {user && (
            <button
              onClick={() => {
                setShowPersonal(true)
                if (!personalBreakdown) loadPersonalBreakdown()
              }}
              disabled={isLoading}
              className="mt-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? '⏳ Cargando...' : '🔍 Compararme con el resto de opositores'}
            </button>
          )}
        </div>
      )}

      {showPersonal && !comparison && !isLoading && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-700">
            <strong>🎯 Tu dificultad personal:</strong> Cómo de difíciles son las preguntas para TI según tu historial.
          </p>
        </div>
      )}

      {/* Comparación visual con gráfico */}
      {showPersonal && comparison && !isLoading && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          comparison.isBetter
            ? 'bg-green-50 border-green-300'
            : comparison.isWorse
              ? 'bg-amber-50 border-amber-300'
              : 'bg-blue-50 border-blue-300'
        }`}>
          {/* Título con resultado */}
          <div className={`font-bold text-lg mb-3 ${
            comparison.isBetter ? 'text-green-800' : comparison.isWorse ? 'text-amber-800' : 'text-blue-800'
          }`}>
            {comparison.isBetter ? '🏆 ¡Vas por encima de la media!' :
             comparison.isWorse ? '📈 Por debajo de la media, ¡pero puedes mejorar!' :
             '📊 Vas a la par con la media'}
          </div>

          {/* Gráfico de barras comparativo */}
          <div className="space-y-3 mb-4">
            {/* Barra: Precisión esperada (media) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">📊 Precisión media esperada</span>
                <span className="font-bold text-gray-700">{comparison.expectedAccuracy}%</span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${comparison.expectedAccuracy}%` }}
                >
                  {comparison.expectedAccuracy > 15 && (
                    <span className="text-xs text-white font-bold">{comparison.expectedAccuracy}%</span>
                  )}
                </div>
              </div>
            </div>

            {/* Barra: Tu precisión real */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={comparison.isBetter ? 'text-green-700' : comparison.isWorse ? 'text-amber-700' : 'text-blue-700'}>
                  🎯 Tu precisión real
                </span>
                <span className={`font-bold ${comparison.isBetter ? 'text-green-700' : comparison.isWorse ? 'text-amber-700' : 'text-blue-700'}`}>
                  {comparison.userAccuracy}% ({comparison.totalCorrect}/{comparison.totalQuestions})
                </span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                    comparison.isBetter ? 'bg-green-500' : comparison.isWorse ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(comparison.userAccuracy, 100)}%` }}
                >
                  {comparison.userAccuracy > 15 && (
                    <span className="text-xs text-white font-bold">{comparison.userAccuracy}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Explicación y mensaje motivacional */}
          <div className={`text-sm ${
            comparison.isBetter ? 'text-green-700' : comparison.isWorse ? 'text-amber-700' : 'text-blue-700'
          }`}>
            <p className="text-xs text-gray-600 mb-2">
              La precisión esperada se calcula según la dificultad de las preguntas que has respondido.
            </p>
            {comparison.isBetter ? (
              <p>🎉 Aciertas más de lo esperado. ¡Vas muy bien preparado!</p>
            ) : comparison.isWorse ? (
              <>
                <p>
                  {userDaysActive !== null && userDaysActive < 30 ? (
                    <>💪 Solo llevas <strong>{userDaysActive} días</strong> en la app.</>
                  ) : userDaysActive !== null && userDaysActive < 90 ? (
                    <>💪 Llevas <strong>{userDaysActive} días</strong> preparándote.</>
                  ) : (
                    <>💪 La constancia es la clave.</>
                  )}
                  {' '}Es normal, <strong>todos pasan por esta fase</strong> antes de superar la media.
                </p>
                <p className="text-xs mt-1 opacity-80">
                  💡 20 minutos diarios son mejores que 3 horas un solo día.
                </p>
              </>
            ) : (
              <p>Tu precisión está en línea con lo esperado. ¡Sigue practicando!</p>
            )}
          </div>
        </div>
      )}

      {currentData && currentData.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {currentData.map((diff, index) => (
            <button key={index} className={`px-4 py-2 rounded-full border-2 transition-all hover:scale-105 ${
              diff.difficulty === 'easy' ? 'bg-green-100 border-green-300 hover:bg-green-200 text-green-800' :
              diff.difficulty === 'medium' ? 'bg-blue-100 border-blue-300 hover:bg-blue-200 text-blue-800' :
              diff.difficulty === 'hard' ? 'bg-orange-100 border-orange-300 hover:bg-orange-200 text-orange-800' :
              'bg-red-100 border-red-300 hover:bg-red-200 text-red-800'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {diff.difficulty === 'easy' ? '🟢' :
                   diff.difficulty === 'medium' ? '🔵' :
                   diff.difficulty === 'hard' ? '🟠' : '🔴'}
                </span>
                <div className="text-left">
                  <div className="font-bold text-sm">
                    {difficultyLabels[diff.difficulty] || diff.difficulty}
                    {showPersonal && <span className="ml-1 text-xs font-normal opacity-75">(para ti)</span>}
                  </div>
                  <div className="text-xs">
                    {showPersonal
                      ? `${diff.total} preguntas • ${diff.accuracy}%`
                      : `${diff.accuracy}% aciertos • ${diff.correct}/${diff.total}`
                    }
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : showPersonal && !isLoading ? (
        <div className="text-center py-8 text-gray-500">
          <p>🎯 Aún no tienes suficientes respuestas para calcular tu dificultad personal.</p>
          <p className="text-sm mt-2">Continúa practicando para ver tu progreso personalizado.</p>
        </div>
      ) : null}
    </div>
  )
}
