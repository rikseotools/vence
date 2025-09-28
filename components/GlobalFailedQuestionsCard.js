// components/GlobalFailedQuestionsCard.js - SOLO SUPABASE (SIMPLE)
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../lib/supabase'
const supabase = getSupabaseClient()

// 🔧 Obtener usuario actual
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Error obteniendo usuario:', error)
    return null
  }
}

// 🔧 Cargar estadísticas desde Supabase
async function loadStatsFromSupabase(userId, tema) {
  try {
    console.log('📊 Cargando estadísticas desde Supabase para tema', tema)
    
    const { data: tests, error } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', userId)
      .like('title', `%Tema ${tema}%`)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('Error cargando tests:', error)
      return null
    }

    if (!tests || tests.length === 0) {
      return { totalFailed: 0, isEmpty: true }
    }

    const totalAttempts = tests.reduce((sum, test) => sum + test.total_questions, 0)
    const totalCorrect = tests.reduce((sum, test) => sum + test.score, 0)
    const totalFailed = totalAttempts - totalCorrect
    const averageScore = Math.round((totalCorrect / totalAttempts) * 100)
    const bestScore = Math.max(...tests.map(test => 
      Math.round((test.score / test.total_questions) * 100)
    ))
    const worstScore = Math.min(...tests.map(test => 
      Math.round((test.score / test.total_questions) * 100)
    ))

    return {
      totalFailed,
      totalAttempts,
      totalCorrect,
      uniqueTests: tests.length,
      averageScore,
      bestScore,
      worstScore,
      lastTestDate: tests[0].completed_at,
      recentTests: tests.slice(0, 3)
    }

  } catch (error) {
    console.error('Error cargando estadísticas:', error)
    return null
  }
}

// 🔧 Formatear fecha
function formatDate(dateString) {
  if (!dateString) return 'Sin fecha'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return 'Fecha inválida'
  }
}

// 🎯 COMPONENTE PRINCIPAL PARA TEMA ESPECÍFICO
export function TemaFailedQuestionsCard({ tema, temaName }) {
  const [temaStats, setTemaStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Obtener usuario actual
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        
        if (!currentUser) {
          setTemaStats({ totalFailed: 0, noUser: true })
          return
        }

        // Cargar estadísticas desde Supabase
        const stats = await loadStatsFromSupabase(currentUser.id, tema)
        setTemaStats(stats)
        
        console.log('📊 Estadísticas cargadas:', stats)

      } catch (error) {
        console.error('Error cargando datos:', error)
        setTemaStats({ totalFailed: 0, error: true })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tema])

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 animate-pulse">
        <div className="flex items-center justify-center">
          <span className="text-2xl mr-3">📊</span>
          <div>
            <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-32"></div>
          </div>
        </div>
      </div>
    )
  }

  // Usuario no autenticado
  if (!user || temaStats?.noUser) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-center">
          <span className="text-2xl mr-3">👤</span>
          <div className="text-center">
            <h3 className="text-lg font-bold text-blue-800 mb-1">
              Inicia sesión para ver estadísticas
            </h3>
            <p className="text-blue-700 text-sm">
              Regístrate gratis para ver tu progreso en {temaName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Sin tests o sin errores
  if (!temaStats || temaStats.isEmpty || temaStats.totalFailed === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-center">
          <span className="text-2xl mr-3">🎉</span>
          <div className="text-center">
            <h3 className="text-lg font-bold text-green-800 mb-1">
              {temaStats?.totalAttempts > 0 ? '¡Dominio Perfecto!' : '¡Empieza tu primer test!'}
            </h3>
            <p className="text-green-700 text-sm">
              {temaStats?.totalAttempts > 0 
                ? `${temaStats.totalCorrect}/${temaStats.totalAttempts} respuestas correctas en ${temaName}`
                : `Aún no has completado tests en ${temaName}`
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <span className="text-3xl mr-3">📊</span>
        <div>
          <h3 className="text-xl font-bold text-orange-800">
            Estadísticas de {temaName}
          </h3>
          <p className="text-orange-600 text-sm">
            {temaStats.totalFailed} errores de {temaStats.totalAttempts} preguntas • {temaStats.uniqueTests} tests realizados
          </p>
        </div>
      </div>
      
      {/* Estadísticas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-600">{temaStats.totalFailed}</div>
          <div className="text-xs text-gray-600">Total Errores</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-600">{temaStats.totalCorrect}</div>
          <div className="text-xs text-gray-600">Total Aciertos</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{temaStats.averageScore}%</div>
          <div className="text-xs text-gray-600">Promedio</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-purple-600">{temaStats.uniqueTests}</div>
          <div className="text-xs text-gray-600">Tests Hechos</div>
        </div>
      </div>

      {/* Evolución */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <h4 className="font-bold text-gray-800 text-sm mb-3">📈 Tu Evolución</h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Mejor resultado</div>
            <div className="font-bold text-green-600">{temaStats.bestScore}%</div>
          </div>
          <div>
            <div className="text-gray-600">Peor resultado</div>
            <div className="font-bold text-red-600">{temaStats.worstScore}%</div>
          </div>
          <div>
            <div className="text-gray-600">Último test</div>
            <div className="font-bold text-blue-600">{formatDate(temaStats.lastTestDate)}</div>
          </div>
        </div>
      </div>

      {/* Tests recientes */}
      {temaStats.recentTests && temaStats.recentTests.length > 0 && (
        <div className="bg-white rounded-lg p-4 mb-4">
          <h4 className="font-bold text-gray-800 text-sm mb-3">🕒 Tests Recientes</h4>
          <div className="space-y-2">
            {temaStats.recentTests.map((test) => {
              const percentage = Math.round((test.score / test.total_questions) * 100)
              return (
                <div key={test.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg ${
                      percentage >= 80 ? '🏆' : percentage >= 60 ? '👍' : '📚'
                    }`}></span>
                    <span className="font-medium">{test.title}</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      percentage >= 80 ? 'text-green-600' : 
                      percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {percentage}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(test.completed_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-800 text-sm mb-2">💡 Para Mejorar en Este Tema</h4>
        <div className="text-blue-700 text-xs space-y-1 mb-3">
          <div>• Repite los tests de este tema varias veces</div>
          <div>• Estudia los artículos específicos que más te cuestan</div>
          <div>• Toma notas de las preguntas problemáticas</div>
          {temaStats.averageScore < 70 && (
            <div>• 🚨 Tu promedio es bajo, necesitas más práctica</div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Link
            href={`/es/auxiliar-administrativo-estado/test/tema-${tema}`}
            className="bg-orange-500 text-white px-4 py-2 rounded text-xs font-medium hover:bg-orange-600 transition-colors flex-1 text-center"
          >
            🔄 Repetir Tests
          </Link>
          <Link
            href={`/es/auxiliar-administrativo-estado/temario/tema-${tema}`}
            className="bg-blue-500 text-white px-4 py-2 rounded text-xs font-medium hover:bg-blue-600 transition-colors flex-1 text-center"
          >
            📖 Estudiar Tema
          </Link>
        </div>
      </div>
    </div>
  )
}

// 🌍 COMPONENTE GLOBAL (simplificado)
export default function GlobalFailedQuestionsCard() {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-blue-200">
      <div className="h-24 bg-gradient-to-r from-blue-500 to-emerald-500 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm font-bold">Estadísticas Globales</div>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="font-bold text-gray-800 text-lg mb-3">
          Estadísticas por Tema
        </h3>
        
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          Las estadísticas se muestran en cada tema individual cuando estés autenticado.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎯</span>
            <div>
              <div className="font-bold text-blue-800 text-sm">Progreso Individual</div>
              <div className="text-blue-600 text-xs">Visita cada tema para ver tus estadísticas detalladas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
