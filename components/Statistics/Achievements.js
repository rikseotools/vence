// components/Statistics/Achievements.js
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUserRankingMedals } from '../../lib/services/rankingMedals'

export default function Achievements({ achievements }) {
  const { user, supabase } = useAuth()
  const [rankingMedals, setRankingMedals] = useState([])
  const [medalsLoading, setMedalsLoading] = useState(true)

  // Cargar medallas de ranking
  useEffect(() => {
    async function loadRankingMedals() {
      if (!user || !supabase) {
        setMedalsLoading(false)
        return
      }

      try {
        const medals = await getUserRankingMedals(supabase, user.id)
        setRankingMedals(medals)
      } catch (error) {
        console.error('Error loading ranking medals:', error)
      } finally {
        setMedalsLoading(false)
      }
    }

    loadRankingMedals()
  }, [user, supabase])

  // Combinar logros de IA existentes con medallas de ranking
  const allAchievements = [
    ...rankingMedals,
    ...(achievements || [])
  ]

  if (allAchievements.length === 0 && !medalsLoading) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">🏆 Logros y Medallas</h3>
        {rankingMedals.length > 0 && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {rankingMedals.length} medallas de ranking
          </div>
        )}
      </div>

      {medalsLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando medallas...</p>
        </div>
      )}

      {!medalsLoading && allAchievements.length > 0 && (
        <>
          {/* Medallas de ranking recientes */}
          {rankingMedals.filter(medal => medal.unlockedAt && 
            new Date() - new Date(medal.unlockedAt) < 7 * 24 * 60 * 60 * 1000
          ).length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                ✨ Medallas Recientes
                <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">¡Nuevas!</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rankingMedals
                  .filter(medal => medal.unlockedAt && 
                    new Date() - new Date(medal.unlockedAt) < 7 * 24 * 60 * 60 * 1000
                  )
                  .map((achievement) => (
                    <MedalCard key={achievement.id} achievement={achievement} isNew={true} />
                  ))
                }
              </div>
            </div>
          )}

          {/* Todos los logros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAchievements.map((achievement) => (
              <MedalCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </>
      )}

      {!medalsLoading && allAchievements.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-gray-600 mb-2">¡Consigue tu primera medalla!</p>
          <p className="text-sm text-gray-500">Participa en el ranking para desbloquear medallas</p>
        </div>
      )}
    </div>
  )
}

// Componente para mostrar una medalla individual
function MedalCard({ achievement, isNew = false }) {
  const isRankingMedal = achievement.rank !== undefined
  
  return (
    <div 
      className={`p-4 rounded-lg border relative ${
        achievement.unlocked 
          ? isRankingMedal
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300'
            : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
          : 'bg-gray-50 border-gray-300'
      }`}
    >
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
          ¡Nuevo!
        </div>
      )}
      
      <div className="flex items-center justify-between mb-3">
        <div className={`text-2xl ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
          {achievement.title.split(' ')[0]}
        </div>
        <div className={`text-xs px-2 py-1 rounded-full font-medium ${
          achievement.unlocked 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-200 text-gray-600'
        }`}>
          {achievement.unlocked ? '✅ Desbloqueado' : '🔒 Bloqueado'}
        </div>
      </div>
      
      <div className="font-bold text-gray-800 mb-1">
        {achievement.title.includes(' ') ? achievement.title.substring(2) : achievement.title}
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        {achievement.description}
      </div>
      
      <div className="text-xs font-medium text-purple-600 mb-1">
        📊 {achievement.progress}
      </div>
      
      <div className="text-xs text-gray-500">
        Categoría: {achievement.category}
      </div>

      {/* Información adicional para medallas de ranking */}
      {isRankingMedal && achievement.unlocked && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          {achievement.rank && (
            <div className="text-xs text-blue-600 mb-1">
              🏆 Posición #{achievement.rank}
            </div>
          )}
          {achievement.stats && (
            <div className="text-xs text-gray-500">
              {achievement.stats.accuracy}% · {achievement.stats.totalQuestions} preguntas
            </div>
          )}
          {achievement.unlockedAt && (
            <div className="text-xs text-gray-400">
              Conseguida: {new Date(achievement.unlockedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}