// components/Statistics/DifficultyBreakdown.js
'use client'

import { useState, useEffect } from 'react'
import { adaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'
import { useAuth } from '@/contexts/AuthContext'

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export default function DifficultyBreakdown({ difficultyBreakdown }) {
  const { supabase } = useAuth()
  const [personalBreakdown, setPersonalBreakdown] = useState(null)
  const [showPersonal, setShowPersonal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const loadPersonalBreakdown = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      const breakdown = await adaptiveDifficultyService.getPersonalDifficultyBreakdown(user.id)
      
      // Convertir a formato compatible con el componente existente
      const personalData = [
        {
          difficulty: 'easy',
          total: breakdown.easy,
          correct: Math.round(breakdown.easy * 0.85), // Estimación
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

  const currentData = showPersonal ? personalBreakdown : difficultyBreakdown
  
  if (!difficultyBreakdown || difficultyBreakdown.length === 0) return null

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
      
      {/* Info desplegable compacta */}
      <div className="mb-4">
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span className="text-lg">ℹ️</span>
          <span className="text-sm font-medium">
            {showPersonal ? '¿Qué es la dificultad personal?' : '¿Cómo funciona la clasificación?'}
          </span>
          <span className="text-xs">{showInfo ? '▼' : '▶'}</span>
        </button>
        
        {showInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2 text-sm">
            {showPersonal ? (
              <div className="space-y-2">
                <p><strong>Dificultad adaptativa:</strong> Se calcula según tu historial personal con cada pregunta.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="font-bold text-green-700">🟢 Easy:</span> ≥85% éxito</div>
                  <div><span className="font-bold text-blue-700">🔵 Medium:</span> 65-84% éxito</div>
                  <div><span className="font-bold text-orange-700">🟠 Hard:</span> 35-64% éxito</div>
                  <div><span className="font-bold text-red-700">🔴 Extreme:</span> &lt;35% éxito</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p><strong>Dificultad estándar:</strong> Se actualiza dinámicamente cada vez que aciertas o fallas preguntas, adaptándose a tu rendimiento personal.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="font-bold text-green-700">🟢 Easy:</span> Conceptos básicos</div>
                  <div><span className="font-bold text-blue-700">🔵 Medium:</span> Términos clave</div>
                  <div><span className="font-bold text-orange-700">🟠 Hard:</span> Terminología técnica</div>
                  <div><span className="font-bold text-red-700">🔴 Extreme:</span> Casos límite</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                  <div className="font-bold text-sm capitalize">
                    {diff.difficulty}
                    {showPersonal && <span className="ml-1 text-xs font-normal">(Personal)</span>}
                  </div>
                  <div className="text-xs">
                    {showPersonal ? `${diff.accuracy}% del total` : `${diff.accuracy}% • ${diff.correct}/${diff.total}`}
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