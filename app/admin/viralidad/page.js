// app/admin/viralidad/page.js - Panel de viralidad y compartidos
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function ViralidadPage() {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [shareEvents, setShareEvents] = useState([])
  const [topQuestions, setTopQuestions] = useState([])
  const [dateFilter, setDateFilter] = useState('7d') // 7d, 30d, all

  useEffect(() => {
    if (supabase) {
      loadViralityData()
    }
  }, [supabase, dateFilter])

  const getDateFilter = () => {
    const now = new Date()
    if (dateFilter === '7d') {
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (dateFilter === '30d') {
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    return null // all time
  }

  const loadViralityData = async () => {
    try {
      setLoading(true)
      const dateFrom = getDateFilter()

      // 1. Eventos de share
      let shareQuery = supabase
        .from('share_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (dateFrom) {
        shareQuery = shareQuery.gte('created_at', dateFrom)
      }

      const { data: shares, error: sharesError } = await shareQuery
      if (sharesError) console.error('Error shares:', sharesError)

      // 2. Calcular estadísticas
      const totalShares = shares?.length || 0

      // Por tipo de share
      const byType = {}
      shares?.forEach(s => {
        byType[s.share_type] = (byType[s.share_type] || 0) + 1
      })

      // Por plataforma
      const byPlatform = {}
      shares?.forEach(s => {
        const platform = s.platform || 'unknown'
        byPlatform[platform] = (byPlatform[platform] || 0) + 1
      })

      // Contar preguntas únicas compartidas
      const uniqueQuestions = new Set(shares?.filter(s => s.question_id).map(s => s.question_id))
      const questionsShared = uniqueQuestions.size

      // Preguntas más compartidas
      const questionShareCount = {}
      shares?.filter(s => s.question_id).forEach(s => {
        questionShareCount[s.question_id] = (questionShareCount[s.question_id] || 0) + 1
      })

      // Obtener detalles de las preguntas más compartidas
      const topQuestionIds = Object.entries(questionShareCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id)

      let topQuestionsData = []
      if (topQuestionIds.length > 0) {
        const { data: questions } = await supabase
          .from('questions')
          .select('id, question_text')
          .in('id', topQuestionIds)

        topQuestionsData = topQuestionIds.map(id => {
          const q = questions?.find(q => q.id === id)
          return {
            id,
            question_text: q?.question_text || 'Pregunta no encontrada',
            shares: questionShareCount[id]
          }
        })
      }

      // Usuarios que más comparten
      const userShareCount = {}
      shares?.forEach(s => {
        if (s.user_id) {
          userShareCount[s.user_id] = (userShareCount[s.user_id] || 0) + 1
        }
      })
      const uniqueSharers = Object.keys(userShareCount).length

      // 3. Obtener usuarios activos para calcular % de compartición
      let activeUsers = 0
      let totalUsers = 0

      // Usuarios que han hecho tests en el período
      let testsQuery = supabase
        .from('tests')
        .select('user_id')

      if (dateFrom) {
        testsQuery = testsQuery.gte('created_at', dateFrom)
      }

      const { data: testsData } = await testsQuery
      const uniqueActiveUsers = new Set(testsData?.map(t => t.user_id).filter(Boolean))
      activeUsers = uniqueActiveUsers.size

      // Total usuarios registrados
      const { count: usersCount } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })

      totalUsers = usersCount || 0

      // Calcular porcentajes
      const shareRateActive = activeUsers > 0 ? (uniqueSharers / activeUsers * 100) : 0
      const shareRateTotal = totalUsers > 0 ? (uniqueSharers / totalUsers * 100) : 0

      setStats({
        totalShares,
        byType,
        byPlatform,
        uniqueSharers,
        questionsShared,
        activeUsers,
        totalUsers,
        shareRateActive,
        shareRateTotal
      })

      setShareEvents(shares || [])
      setTopQuestions(topQuestionsData)

    } catch (error) {
      console.error('Error loading virality data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getShareTypeLabel = (type) => {
    const labels = {
      'question_quiz': 'Pregunta Quiz',
      'question_educational': 'Pregunta Educativa',
      'exam_result': 'Resultado Examen',
      'streak': 'Racha',
      'ranking': 'Ranking'
    }
    return labels[type] || type
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      'whatsapp': '💬',
      'twitter': '🐦',
      'x': '𝕏',
      'telegram': 'telegram',
      'copy': '📋',
      'facebook': '📘',
      'linkedin': '💼',
      'native': '📱'
    }
    return icons[platform] || '🔗'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🚀</span> Viralidad y Compartidos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Análisis de contenido compartido y engagement viral
          </p>
        </div>

        {/* Filtro de fecha */}
        <div className="flex gap-2">
          {['7d', '30d', 'all'].map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {filter === '7d' ? '7 días' : filter === '30d' ? '30 días' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjeta: Tasa de Compartición con Benchmark */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 shadow-lg text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-4xl font-bold">{stats?.shareRateActive?.toFixed(1) || 0}%</span>
              <span className="text-sm opacity-75 ml-2">comparte</span>
            </div>
            <div className="text-sm opacity-75 border-l border-white/30 pl-4">
              <div>{stats?.uniqueSharers || 0} de {stats?.activeUsers || 0} usuarios</div>
              <div className="text-xs">que han hecho tests ({dateFilter === '7d' ? '7 días' : dateFilter === '30d' ? '30 días' : 'siempre'})</div>
            </div>
          </div>

          {/* Benchmark */}
          {(() => {
            const rate = stats?.shareRateActive || 0
            let level, icon
            if (rate < 3) { level = 'Muy Bajo'; icon = '🔴' }
            else if (rate < 5) { level = 'Bajo'; icon = '🟠' }
            else if (rate < 10) { level = 'Normal'; icon = '🟡' }
            else if (rate < 15) { level = 'Bueno'; icon = '🟢' }
            else { level = 'Excelente'; icon = '🌟' }
            return (
              <div className="bg-white/20 rounded-lg px-4 py-2 text-center">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="font-bold">{level}</span>
                </div>
                <div className="text-xs opacity-75">Benchmark: 5-15%</div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-blue-600">{stats?.totalShares || 0}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Compartidos</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-purple-600">
            {stats?.uniqueSharers > 0 ? (stats.totalShares / stats.uniqueSharers).toFixed(1) : 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Shares por Usuario</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-green-600">{stats?.questionsShared || 0}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Preguntas Compartidas</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-orange-600">
            {stats?.activeUsers > 0 ? (stats.totalShares / stats.activeUsers).toFixed(2) : 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Shares por Usuario Activo</div>
        </div>
      </div>

      {/* Por Tipo y Plataforma */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Por Tipo de Share */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 Por Tipo de Contenido
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.byType || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">{getShareTypeLabel(type)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(count / (stats?.totalShares || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(stats?.byType || {}).length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No hay datos</p>
            )}
          </div>
        </div>

        {/* Por Plataforma */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📱 Por Plataforma
          </h3>
          <div className="space-y-3">
            {Object.entries(stats?.byPlatform || {}).sort((a, b) => b[1] - a[1]).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span>{getPlatformIcon(platform)}</span>
                  <span className="capitalize">{platform}</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(count / (stats?.totalShares || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(stats?.byPlatform || {}).length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No hay datos</p>
            )}
          </div>
        </div>
      </div>

      {/* Preguntas más compartidas */}
      {topQuestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🏆 Preguntas Más Compartidas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Pregunta</th>
                  <th className="text-center py-2 px-2 text-gray-600 dark:text-gray-400">Veces Compartida</th>
                </tr>
              </thead>
              <tbody>
                {topQuestions.map((q, i) => (
                  <tr key={q.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                        <span className="text-gray-800 dark:text-gray-200 line-clamp-2">
                          {q.question_text.substring(0, 120)}...
                        </span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 font-semibold text-blue-600">{q.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compartidos recientes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📤 Compartidos Recientes
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {shareEvents.slice(0, 30).map(event => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getPlatformIcon(event.platform)}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {getShareTypeLabel(event.share_type)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event.created_at)}
                  </div>
                </div>
              </div>
              {event.score && (
                <span className="text-sm font-semibold text-blue-600">
                  {event.score}%
                </span>
              )}
            </div>
          ))}
          {shareEvents.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No hay compartidos en este período
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
