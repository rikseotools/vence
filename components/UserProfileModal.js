'use client'
import { useState, useEffect } from 'react'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { getOposicionById } from '@/lib/config/oposiciones'

export default function UserProfileModal({ isOpen, onClose, userId, userName }) {
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [todayActivity, setTodayActivity] = useState(null)

  useEffect(() => {
    if (isOpen && userId) {
      console.log('🔍 Cargando perfil de usuario:', userId)
      loadUserProfile()
    }
  }, [isOpen, userId])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  const loadUserProfile = async () => {
    setLoading(true)
    try {
      // 1+1.5+3. Perfil público + avatar settings + tests de hoy en UN endpoint
      // agnóstico (Drizzle). 🔒 Los tests SOLO se devuelven si el viewer es el dueño
      // o admin (el endpoint replica la RLS de `tests`); para otros viewers llega [].
      // Fechas de hoy del cliente para preservar el corte de medianoche por tz.
      const todayBoundary = new Date()
      todayBoundary.setHours(0, 0, 0, 0)
      const tomorrowBoundary = new Date(todayBoundary)
      tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1)

      let publicProfile = null
      let avatarSettings = null
      let todayTests = []
      try {
        const headers = await getAuthHeaders()
        const qs = new URLSearchParams({
          userId,
          todayStart: todayBoundary.toISOString(),
          todayEnd: tomorrowBoundary.toISOString(),
        })
        const res = await fetch(`/api/v2/user-public-profile?${qs}`, { headers })
        if (res.ok) {
          const body = await res.json()
          publicProfile = body.publicProfile
          avatarSettings = body.avatarSettings
          todayTests = body.todayTests || []
        } else {
          console.error('Error loading public profile:', res.status)
        }
      } catch (profileError) {
        console.error('Error loading public profile:', profileError)
      }

      // 2. Cargar estadísticas generales via API (usa user_stats_summary, <1ms)
      // Antes usaba una RPC get_user_public_stats que hacía count(*) sobre
      // test_questions (11s para heavy users → 504 → cascada de saturación).
      let stats = null
      try {
        const statsRes = await fetch(`/api/v2/user-stats?userId=${userId}`)
        const statsData = await statsRes.json()
        if (statsData) {
          stats = [statsData] // Wrap en array para compatibilidad con el código que lee stats[0]
        }
      } catch (statsError) {
        console.error('Error loading stats:', statsError)
      }

      // Debug: Ver qué está devolviendo la RPC para actividad de hoy
      if (stats?.[0]) {
        console.log('📊 UserProfileModal - Stats para usuario:', {
          userId: userId.substring(0, 8),
          today_tests: stats[0].today_tests,
          today_questions: stats[0].today_questions,
          today_correct: stats[0].today_correct
        })
      }

      // 3. (los tests de hoy ya vienen del endpoint user-public-profile arriba)

      // 3.5. Método de estudio: derivado de tests completados.
      // La API ya no devuelve mastered_topics (era cálculo on-the-fly de
      // 8s+ para heavy users). Si el usuario tiene tests completados,
      // asumimos que estudia activamente.
      const totalTestsCompleted = stats?.[0]?.totalTestsCompleted || 0

      let studyMethodData = {
        studyMethod: 'random'  // placeholder hasta que precomputemos mastered_topics
      }

      // 4. Calcular tiempo en Vence (userCreatedAt viene de user_profiles)
      const createdAt = stats?.[0]?.userCreatedAt ? new Date(stats[0].userCreatedAt) : null
      const timeInVence = calculateTimeInVence(createdAt)

      // 5. Extraer leyes únicas estudiadas hoy
      const lawsToday = extractUniqueLastToday(todayTests)

      // 6. Calcular estadísticas por tipo de test (práctica vs examen)
      const practiceTests = todayTests?.filter(t => t.test_type === 'practice' && t.is_completed) || []
      const examTests = todayTests?.filter(t => t.test_type === 'exam' && t.is_completed) || []

      const practiceStats = {
        count: practiceTests.length,
        totalQuestions: practiceTests.reduce((sum, t) => sum + (t.total_questions || 0), 0),
        correctAnswers: practiceTests.reduce((sum, t) => sum + (t.score || 0), 0)
      }

      const examStats = {
        count: examTests.length,
        totalQuestions: examTests.reduce((sum, t) => sum + (t.total_questions || 0), 0),
        correctAnswers: examTests.reduce((sum, t) => sum + (t.score || 0), 0)
      }

      // Obtener nombre apropiado (evitar "Usuario" genérico)
      let displayName = userName // Fallback inicial

      // Si tiene display_name pero no es genérico, usarlo.
      // Si es genérico ("Usuario") o NULL, mantener el userName del prop
      // (caller). NO leer de admin_users_with_roles — exponía email + full_name
      // de cualquier user a cualquier authenticated vía SECURITY DEFINER.
      if (publicProfile?.display_name && publicProfile.display_name !== 'Usuario') {
        displayName = publicProfile.display_name
      }

      // Determinar avatar (prioridad: automático > manual)
      let avatarType = publicProfile?.avatar_type
      let avatarEmoji = publicProfile?.avatar_emoji
      let avatarColor = publicProfile?.avatar_color
      let avatarUrl = publicProfile?.avatar_url

      if (avatarSettings?.current_emoji) {
        avatarType = 'automatic'
        avatarEmoji = avatarSettings.current_emoji
        avatarColor = 'from-indigo-500 to-purple-500'
      }

      // Combinar todos los datos. La API user-stats devuelve campos en
      // camelCase; aquí los normalizamos a snake_case para el resto del
      // componente sin tocar el JSX.
      const s = stats?.[0] || {}
      const finalData = {
        display_name: displayName,
        ciudad: publicProfile?.ciudad,
        avatar_type: avatarType,
        avatar_emoji: avatarEmoji,
        avatar_color: avatarColor,
        avatar_url: avatarUrl,

        // Stats globales (camelCase desde API → snake_case interno)
        total_questions: s.totalQuestions || 0,
        global_accuracy: s.globalAccuracy || 0,
        correct_answers: s.correctAnswers || 0,
        incorrect_answers: s.incorrectAnswers || 0,
        blank_answers: s.blankAnswers || 0,
        questions_this_week: s.questionsThisWeek || 0,

        // Perfil
        target_oposicion: s.targetOposicion || null,
        time_in_vence: timeInVence,

        // Racha
        current_streak: s.currentStreak || 0,
        longest_streak: s.longestStreak || 0,
        streak: s.currentStreak || 0,

        // Tests
        total_tests_completed: s.totalTestsCompleted || 0,
        today_tests: s.todayTests || 0,
        today_questions: s.todayQuestions || 0,
        today_correct: s.todayCorrect || 0,

        study_method: studyMethodData.studyMethod,
      }

      console.log('✅ ProfileData establecido:', {
        display_name: displayName,
        target_oposicion: finalData.target_oposicion,
        time_in_vence: finalData.time_in_vence,
        total_questions: finalData.total_questions,
      })

      setProfileData(finalData)

      setTodayActivity({
        tests: todayTests || [],
        total_questions: s.todayQuestions || 0,
        correct_answers: s.todayCorrect || 0,
        laws_studied: lawsToday,
        practiceStats,
        examStats
      })

    } catch (error) {
      console.error('Error loading user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTimeInVence = (createdAt) => {
    if (!createdAt) return 'Nuevo usuario'

    const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
    if (Number.isNaN(created.getTime())) return 'Nuevo usuario'
    const now = new Date()
    const diffMs = now - created
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 1) return 'Hoy'
    if (diffDays === 1) return '1 día'
    if (diffDays < 30) return `${diffDays} días`
    if (diffDays < 60) return '1 mes'
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} ${months === 1 ? 'mes' : 'meses'}`
    }

    const years = Math.floor(diffDays / 365)
    const remainingMonths = Math.floor((diffDays % 365) / 30)

    if (remainingMonths === 0) {
      return `${years} ${years === 1 ? 'año' : 'años'}`
    }

    return `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`
  }

  const extractUniqueLastToday = (tests) => {
    if (!tests || tests.length === 0) return []

    const laws = new Set()
    tests.forEach(test => {
      if (test.title) {
        // Extraer leyes del title si contiene info de leyes
        const lawMatch = test.title.match(/Ley [^,]+|CE|LO [^,]+|RD [^,]+/g)
        if (lawMatch) {
          lawMatch.forEach(law => laws.add(law.trim()))
        }
      }
    })

    return Array.from(laws)
  }

  const getOposicionName = (oposicion) => {
    if (!oposicion) return 'Auxiliar Administrativo del Estado'
    // Si es un UUID, devolver valor por defecto
    if (oposicion.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return 'Auxiliar Administrativo del Estado'
    }
    // Normalizar: guiones → underscores para buscar por id
    const normalized = oposicion.replace(/-/g, '_')
    return getOposicionById(normalized)?.name || 'Auxiliar Administrativo del Estado'
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 z-[1000] overflow-y-auto"
    >
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center">
                👤 Perfil de Opositor
              </h2>
              <p className="text-blue-100 text-sm">Información pública del usuario</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="text-white font-bold">×</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando perfil...</p>
              </div>
            ) : profileData ? (
              <div className="space-y-6">
                {/* Información básica */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {/* Avatar del usuario */}
                      {(profileData.avatar_type === 'automatic' || profileData.avatar_type === 'predefined') && profileData.avatar_emoji ? (
                        <div className={`w-16 h-16 bg-gradient-to-r ${profileData.avatar_color || 'from-blue-500 to-blue-600'} rounded-full flex items-center justify-center text-3xl`}>
                          {profileData.avatar_emoji}
                        </div>
                      ) : (profileData.avatar_type === 'uploaded' || profileData.avatar_type === 'google') && profileData.avatar_url ? (
                        <img
                          src={profileData.avatar_url}
                          alt={profileData.display_name || 'Avatar'}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                          {profileData.display_name?.[0]?.toUpperCase() || userName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {profileData.display_name || userName}
                        </h3>
                        {profileData.ciudad && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <span className="mr-1">📍</span>
                            {profileData.ciudad}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">En Vence desde hace</p>
                      <p className="text-lg font-bold text-blue-600">{profileData.time_in_vence}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-500">🎯 Oposición</p>
                      <p className="font-medium">{getOposicionName(profileData.target_oposicion)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">🔥 Racha actual</p>
                      <p className="font-medium">{profileData.streak} días</p>
                    </div>
                  </div>

                  {/* Resumen de actividad. La distinción por método de estudio
                      (by_topics vs random) dependía de mastered_topics, que era
                      cálculo de 8s+ para heavy users; vuelve cuando precomputemos. */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium text-blue-600 dark:text-blue-400">📚 {profileData.display_name || 'Usuario'}</span>
                        <span className="text-gray-500 dark:text-gray-400"> ha completado {profileData.total_tests_completed || 0} tests</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Estadísticas generales */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">📊 Estadísticas Generales</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {profileData.total_questions || 0}
                      </p>
                      <p className="text-xs text-gray-500">Preguntas totales</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {profileData.global_accuracy || 0}%
                      </p>
                      <p className="text-xs text-gray-500">Precisión global</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {profileData.longest_streak || 0}
                      </p>
                      <p className="text-xs text-gray-500">Mejor racha</p>
                    </div>
                    {/* Tests completados (sustituye la antigua "Temas dominados"
                        que requería cálculo de 8s+ para heavy users. Pendiente
                        precompute en user_topic_stats para reintroducirlo). */}
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">
                        {profileData.total_tests_completed || 0}
                      </p>
                      <p className="text-xs text-gray-500">Tests completados</p>
                    </div>
                  </div>
                </div>

                {/* Evolución de precisión */}
                {(profileData.accuracy_this_week || profileData.accuracy_last_month || profileData.accuracy_three_months_ago) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">📈 Evolución de Precisión</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {profileData.accuracy_this_week ? (
                            <span className="text-blue-600">{profileData.accuracy_this_week}%</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">Esta semana</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {profileData.accuracy_last_month ? (
                            <span className={
                              profileData.accuracy_last_month < profileData.accuracy_this_week
                                ? "text-green-600"
                                : "text-gray-600"
                            }>
                              {profileData.accuracy_last_month}%
                              {profileData.accuracy_this_week && (
                                <span className="text-xs ml-1">
                                  {profileData.accuracy_this_week > profileData.accuracy_last_month ? '↑' :
                                   profileData.accuracy_this_week < profileData.accuracy_last_month ? '↓' : ''}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">Mes pasado</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {profileData.accuracy_three_months_ago ? (
                            <span className="text-gray-600">{profileData.accuracy_three_months_ago}%</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">Hace 3 meses</p>
                      </div>
                    </div>
                    {/* Indicador de tendencia */}
                    {profileData.accuracy_this_week && profileData.accuracy_last_month && (
                      <div className="mt-3 text-center">
                        <p className="text-xs text-gray-600">
                          {profileData.accuracy_this_week > profileData.accuracy_last_month ? (
                            <span className="text-green-600 font-medium">
                              📈 Mejorando (+{(profileData.accuracy_this_week - profileData.accuracy_last_month).toFixed(1)}%)
                            </span>
                          ) : profileData.accuracy_this_week < profileData.accuracy_last_month ? (
                            <span className="text-red-600 font-medium">
                              📉 Bajando ({(profileData.accuracy_this_week - profileData.accuracy_last_month).toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-gray-600">➡️ Estable</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actividad de hoy */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">📚 Actividad de Hoy</h4>
                  {todayActivity?.total_questions > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Preguntas respondidas</span>
                        <span className="font-bold">{todayActivity.total_questions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Respuestas correctas</span>
                        <span className="font-bold text-green-600">
                          {todayActivity.correct_answers}
                          ({Math.round((todayActivity.correct_answers / todayActivity.total_questions) * 100)}%)
                        </span>
                      </div>

                      {/* Tarjetas de tests por tipo */}
                      {(todayActivity.practiceStats?.count > 0 || todayActivity.examStats?.count > 0) && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {/* Tests de Práctica */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">📝</span>
                              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Tests de Práctica</span>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {todayActivity.practiceStats?.count || 0}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">completados</p>
                              {todayActivity.practiceStats?.totalQuestions > 0 && (
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                                  Precisión: {Math.round((todayActivity.practiceStats.correctAnswers / todayActivity.practiceStats.totalQuestions) * 100)}%
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Tests de Examen */}
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">📋</span>
                              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Tests de Examen</span>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {todayActivity.examStats?.count || 0}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">completados</p>
                              {todayActivity.examStats?.totalQuestions > 0 && (
                                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1">
                                  Precisión: {Math.round((todayActivity.examStats.correctAnswers / todayActivity.examStats.totalQuestions) * 100)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {todayActivity.laws_studied.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Leyes estudiadas:</p>
                          <div className="flex flex-wrap gap-2">
                            {todayActivity.laws_studied.map((law, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                              >
                                {law}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No ha estudiado hoy todavía</p>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No se pudo cargar el perfil</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}