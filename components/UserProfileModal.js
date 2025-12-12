'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function UserProfileModal({ isOpen, onClose, userId, userName }) {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [todayActivity, setTodayActivity] = useState(null)

  useEffect(() => {
    if (isOpen && userId && supabase) {
      console.log('🔍 Cargando perfil de usuario:', userId)
      loadUserProfile()
    }
  }, [isOpen, userId, supabase])

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
      // 1. Cargar datos básicos del perfil desde public_user_profiles (accesible para todos)
      const { data: publicProfile, error: publicProfileError } = await supabase
        .from('public_user_profiles')
        .select('display_name, ciudad')
        .eq('id', userId)
        .maybeSingle() // Usar maybeSingle en lugar de single para evitar error si no existe

      if (publicProfileError && publicProfileError.code !== 'PGRST116') {
        console.error('Error loading public profile:', publicProfileError)
      }

      // 2. Cargar estadísticas generales (incluyendo racha, oposición, actividad de hoy)
      const { data: stats, error: statsError } = await supabase.rpc('get_user_public_stats', {
        p_user_id: userId
      })

      if (statsError) {
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

      // 3. Cargar tests detallados de hoy para extraer leyes
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: todayTests } = await supabase
        .from('tests')
        .select('title, test_type, is_completed, score, total_questions')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      // 3.5. Analizar método de estudio basado en mastered_topics
      const masteredTopics = stats?.[0]?.mastered_topics || 0

      let studyMethodData = {
        studyMethod: masteredTopics > 1 ? 'by_topics' : 'random'
      }

      // 4. Calcular tiempo en Vence
      const createdAt = new Date(stats?.[0]?.user_created_at)
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

      // Si tiene display_name pero no es genérico, usarlo
      if (publicProfile?.display_name && publicProfile.display_name !== 'Usuario') {
        displayName = publicProfile.display_name
      } else {
        // Intentar obtener el nombre desde admin_users_with_roles
        const { data: adminProfile } = await supabase
          .from('admin_users_with_roles')
          .select('full_name, email')
          .eq('user_id', userId)
          .maybeSingle()

        if (adminProfile) {
          // Usar full_name si no es genérico
          if (adminProfile.full_name && adminProfile.full_name !== 'Usuario') {
            const firstName = adminProfile.full_name.split(' ')[0]
            if (firstName?.trim() && firstName !== 'Usuario') {
              displayName = firstName.trim()
            }
          } else if (adminProfile.email) {
            // Usar email como fallback
            const emailName = adminProfile.email.split('@')[0]
            const cleanName = emailName.replace(/[0-9]+/g, '').replace(/[._-]/g, ' ').trim()
            if (cleanName) {
              displayName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
            } else {
              displayName = emailName
            }
          }
        }
      }

      // Combinar todos los datos (la nueva RPC trae todo)
      const finalData = {
        ...stats?.[0],
        display_name: displayName,
        ciudad: publicProfile?.ciudad,
        streak: stats?.[0]?.current_streak || 0,
        time_in_vence: timeInVence,
        mastered_topics: stats?.[0]?.mastered_topics || 0,
        study_method: studyMethodData.studyMethod
      }

      console.log('✅ ProfileData establecido:', {
        display_name: displayName,
        mastered_topics: finalData.mastered_topics,
        time_in_vence: finalData.time_in_vence
      })

      setProfileData(finalData)

      setTodayActivity({
        tests: todayTests || [],
        total_questions: stats?.[0]?.today_questions || 0,
        correct_answers: stats?.[0]?.today_correct || 0,
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

    const now = new Date()
    const created = new Date(createdAt)
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
    // Si es un UUID, devolver valor por defecto
    if (oposicion?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return 'Auxiliar Administrativo del Estado'
    }

    // Normalizar el valor (quitar guiones para comparar)
    const normalized = oposicion?.replace(/-/g, '_')

    const oposiciones = {
      'auxiliar_administrativo_estado': 'Auxiliar Administrativo del Estado',
      'administrativo_estado': 'Administrativo del Estado',
      'gestion_estado': 'Gestión del Estado',
      'tramitacion_procesal': 'Tramitación Procesal',
      'auxilio_judicial': 'Auxilio Judicial',
      'gestion_procesal': 'Gestión Procesal',
      'auxiliar_ayuntamiento': 'Auxiliar de Ayuntamiento'
    }

    return oposiciones[normalized] || 'Auxiliar Administrativo del Estado'
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
                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {profileData.display_name?.[0]?.toUpperCase() || userName?.[0]?.toUpperCase() || '?'}
                      </div>
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

                  {/* Indicador descriptivo de método de estudio */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      {profileData.study_method === 'by_topics' ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-purple-600 dark:text-purple-400">📚 {profileData.display_name || 'Usuario'} estudia por temas</span>
                          <span className="text-gray-500 dark:text-gray-400"> ({profileData.mastered_topics} temas dominados)</span>
                        </p>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-blue-600 dark:text-blue-400">🎲 {profileData.display_name || 'Usuario'} hace tests aleatorios principalmente</span>
                          <span className="text-gray-500 dark:text-gray-400"> ({profileData.total_tests_completed || 0} tests completados)</span>
                        </p>
                      )}
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
                    {/* Solo mostrar temas dominados si tiene oposición auxiliar_administrativo_estado
                        Y si realmente estudia por temas (más de 1 tema dominado).
                        Si solo tiene 0-1 temas, probablemente hace tests aleatorios */}
                    {(() => {
                      const normalizedOposicion = profileData.target_oposicion?.replace(/-/g, '_')
                      const isAuxiliar = normalizedOposicion === 'auxiliar_administrativo_estado'
                      console.log('🔍 Evaluando condición temas dominados:', {
                        target_oposicion: profileData.target_oposicion,
                        normalized: normalizedOposicion,
                        mastered_topics: profileData.mastered_topics,
                        isAuxiliar,
                        condition: isAuxiliar && (profileData.mastered_topics || 0) > 1
                      })
                      return null
                    })()}
                    {profileData.target_oposicion?.replace(/-/g, '_') === 'auxiliar_administrativo_estado' && (profileData.mastered_topics || 0) > 1 ? (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {profileData.mastered_topics || 0}
                          <span className="text-base text-gray-500 ml-1">/28</span>
                          <span className="text-xs text-gray-400 block">
                            ({Math.round(((profileData.mastered_topics || 0) / 28) * 100)}%)
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Temas dominados</p>
                        {(() => {
                          const temasDominados = profileData.mastered_topics || 0
                          const temasPendientes = 28 - temasDominados

                          // Calcular ritmo de progreso basado en tiempo en Vence
                          const diasEnVence = profileData.time_in_vence ? (() => {
                            const timeStr = profileData.time_in_vence
                            if (timeStr.includes('año')) {
                              const years = parseInt(timeStr.match(/(\d+)\s+año/)?.[1] || 0)
                              const months = parseInt(timeStr.match(/(\d+)\s+mes/)?.[1] || 0)
                              return years * 365 + months * 30
                            } else if (timeStr.includes('mes')) {
                              const months = parseInt(timeStr.match(/(\d+)\s+mes/)?.[1] || 0)
                              return months * 30
                            } else if (timeStr.includes('día')) {
                              return parseInt(timeStr.match(/(\d+)\s+día/)?.[1] || 1)
                            }
                            return 1
                          })() : 30

                          console.log('📅 Predicción temario:', {
                            temasDominados,
                            temasPendientes,
                            diasEnVence,
                            timeInVence: profileData.time_in_vence
                          })

                          // Si hay temas dominados, calcular ritmo
                          if (temasDominados > 0 && temasPendientes > 0) {
                            const temasPoSemana = (temasDominados / diasEnVence) * 7
                            const semanasNecesarias = Math.ceil(temasPendientes / temasPoSemana)

                            console.log('📊 Cálculo ritmo:', {
                              temasPoSemana,
                              semanasNecesarias
                            })

                            // Calcular fecha proyectada
                            const fechaProyectada = new Date()
                            fechaProyectada.setDate(fechaProyectada.getDate() + (semanasNecesarias * 7))

                            // Formatear fecha
                            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                                           'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                            const fechaFormateada = `${fechaProyectada.getDate()} ${meses[fechaProyectada.getMonth()]} ${fechaProyectada.getFullYear()}`

                            // Solo mostrar si es una proyección razonable (menos de 2 años)
                            if (semanasNecesarias < 104) {
                              return (
                                <p className="text-xs text-green-600 mt-2">
                                  📅 A este ritmo, {profileData.display_name || 'dominarás'} {profileData.display_name ? 'dominará' : ''} todo el temario para el <span className="font-bold">{fechaFormateada}</span>
                                </p>
                              )
                            }
                          } else if (temasDominados === 28) {
                            return (
                              <p className="text-xs text-green-600 mt-2">
                                ✅ ¡Felicidades! Has dominado todo el temario
                              </p>
                            )
                          }
                          return null
                        })()}
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-600">
                          {profileData.total_tests_completed || 0}
                        </p>
                        <p className="text-xs text-gray-500">Tests completados</p>
                      </div>
                    )}
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