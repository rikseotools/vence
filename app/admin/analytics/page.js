// app/admin/analytics/page.js - Análisis detallado de abandono
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function AnalyticsPage() {
  const { supabase } = useAuth()
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reviewModal, setReviewModal] = useState({ isOpen: false, question: null, detectionType: null })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadAnalytics() {
      if (!supabase) return

      try {
        setLoading(true)
        console.log('📊 Cargando analytics completos...')

        // 1. Obtener todos los tests con información de usuario
        const { data: allTests, error: testsError } = await supabase
          .from('tests')
          .select(`
            id,
            user_id,
            total_questions,
            score,
            is_completed,
            started_at,
            completed_at,
            tema_number,
            user_profiles!inner(email, full_name, is_active_student, created_at)
          `)

        if (testsError) throw testsError

        // 2. Obtener preguntas respondidas para análisis de abandono (solo preguntas activas)
        const { data: testQuestions, error: questionsError } = await supabase
          .from('test_questions')
          .select(`
            test_id,
            question_order,
            is_correct,
            time_spent_seconds,
            confidence_level,
            article_number,
            law_name,
            question_id,
            question_text,
            tests!inner(is_completed, user_id, total_questions),
            questions!inner(is_active)
          `)
          .eq('questions.is_active', true)

        if (questionsError) throw questionsError

        // 3. Procesar datos
        const processedData = await processAnalyticsData(allTests, testQuestions)
        setAnalyticsData(processedData)

        console.log('✅ Analytics cargados:', processedData)

      } catch (err) {
        console.error('❌ Error cargando analytics:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [supabase])

  async function processAnalyticsData(tests, questions) {
    // Separar tests completados vs abandonados
    const completed = tests.filter(t => t.is_completed)
    const abandoned = tests.filter(t => !t.is_completed)

    // Análisis por usuario
    const userStats = {}
    tests.forEach(test => {
      const email = test.user_profiles.email
      if (!userStats[email]) {
        userStats[email] = {
          name: test.user_profiles.full_name || 'Sin nombre',
          email,
          isActiveStudent: test.user_profiles.is_active_student,
          registeredAt: test.user_profiles.created_at,
          completed: 0,
          abandoned: 0,
          totalTests: 0,
          totalQuestions: 0,
          totalScore: 0
        }
      }
      
      const user = userStats[email]
      user.totalTests++
      user.totalQuestions += test.total_questions || 0
      
      if (test.is_completed) {
        user.completed++
        user.totalScore += test.score || 0
      } else {
        user.abandoned++
      }
    })

    // Convertir a array y calcular métricas
    const usersArray = Object.values(userStats).map(user => {
      const completionRate = user.totalTests > 0 ? Math.round((user.completed / user.totalTests) * 100) : 0
      const avgAccuracy = user.completed > 0 ? Math.round((user.totalScore / (user.completed * 25)) * 100) : 0 // Asumiendo 25 preguntas promedio
      
      return {
        ...user,
        completionRate,
        avgAccuracy,
        abandonmentRate: user.totalTests > 0 ? Math.round((user.abandoned / user.totalTests) * 100) : 0,
        questionsPerTest: user.totalTests > 0 ? Math.round(user.totalQuestions / user.totalTests) : 0
      }
    })

    // Clasificar usuarios
    const powerUsers = usersArray.filter(u => u.completionRate >= 80 && u.totalTests >= 2)
    const riskUsers = usersArray.filter(u => u.abandonmentRate > 50 || (u.totalTests === 0 && u.isActiveStudent === false))
    const normalUsers = usersArray.filter(u => !powerUsers.includes(u) && !riskUsers.includes(u))

    // Análisis de puntos de abandono
    const abandonmentPoints = {}
    const testAbandonmentData = {}

    questions.forEach(q => {
      if (!q.tests.is_completed) { // Solo tests abandonados
        const testId = q.test_id
        if (!testAbandonmentData[testId]) {
          testAbandonmentData[testId] = 0
        }
        testAbandonmentData[testId] = Math.max(testAbandonmentData[testId], q.question_order)
      }
    })

    Object.values(testAbandonmentData).forEach(lastQuestion => {
      const range = getQuestionRange(lastQuestion)
      abandonmentPoints[range] = (abandonmentPoints[range] || 0) + 1
    })

    // Análisis de contenido problemático
    const articleStats = {}
    questions.forEach(q => {
      const key = `${q.law_name || 'Sin ley'} - Art. ${q.article_number || 'Sin artículo'}`
      if (!articleStats[key]) {
        articleStats[key] = {
          article: q.article_number || 'Sin artículo',
          law: q.law_name || 'Sin ley',
          totalAttempts: 0,
          correctAttempts: 0,
          abandonedIn: 0,
          completedIn: 0,
          lowConfidence: 0
        }
      }

      const stats = articleStats[key]
      stats.totalAttempts++
      
      if (q.is_correct) stats.correctAttempts++
      if (['unsure', 'guessing'].includes(q.confidence_level)) stats.lowConfidence++
      
      if (q.tests.is_completed) {
        stats.completedIn++
      } else {
        stats.abandonedIn++
      }
    })

    const problematicArticles = Object.values(articleStats)
      .filter(a => a.totalAttempts >= 3)
      .map(a => ({
        ...a,
        accuracy: Math.round((a.correctAttempts / a.totalAttempts) * 100),
        abandonmentRate: Math.round((a.abandonedIn / a.totalAttempts) * 100),
        confidenceIssueRate: Math.round((a.lowConfidence / a.totalAttempts) * 100)
      }))
      .filter(a => a.abandonmentRate > 30 || a.accuracy < 60)
      .sort((a, b) => b.abandonmentRate - a.abandonmentRate)

    // 🚨 NUEVO: Análisis de preguntas específicas que causan abandono
    const questionAbandonmentStats = {}
    
    questions.forEach(q => {
      const questionKey = q.question_id || `${q.question_text?.substring(0, 50)}...`
      
      if (!questionAbandonmentStats[questionKey]) {
        questionAbandonmentStats[questionKey] = {
          questionId: q.question_id,
          questionText: q.question_text?.substring(0, 100) + (q.question_text?.length > 100 ? '...' : ''),
          totalAppearances: 0,
          abandonedAt: 0,
          completedAfter: 0,
          avgQuestionOrder: 0,
          totalQuestionOrders: [],
          uniqueTests: new Set(),
          uniqueUsersAbandoned: new Set(),
          article: q.article_number || 'Sin artículo',
          law: q.law_name || 'Sin ley'
        }
      }

      const stats = questionAbandonmentStats[questionKey]
      stats.totalAppearances++
      stats.totalQuestionOrders.push(q.question_order)
      stats.uniqueTests.add(q.test_id)
      
      if (!q.tests.is_completed) {
        // Test abandonado - verificar si fue la última pregunta respondida
        stats.abandonedAt++
        stats.uniqueUsersAbandoned.add(q.tests.user_id)
      } else {
        stats.completedAfter++
      }
    })

    const problematicQuestions = Object.values(questionAbandonmentStats)
      .filter(q => q.totalAppearances >= 2 && q.abandonedAt >= 2) // Al menos 2 apariciones y 2 abandonos
      .map(q => ({
        ...q,
        avgQuestionOrder: Math.round(q.totalQuestionOrders.reduce((a, b) => a + b, 0) / q.totalQuestionOrders.length),
        abandonmentRate: Math.round((q.abandonedAt / q.totalAppearances) * 100),
        uniqueTestsCount: q.uniqueTests.size,
        uniqueUsersAbandonedCount: q.uniqueUsersAbandoned.size
      }))
      .filter(q => q.abandonmentRate >= 40) // Al menos 40% de abandono
      .sort((a, b) => b.uniqueUsersAbandonedCount - a.uniqueUsersAbandonedCount) // Ordenar por usuarios únicos afectados

    // 🎯 NUEVO: Análisis de preguntas falladas frecuentemente
    const questionFailureStats = {}
    
    questions.forEach(q => {
      const questionKey = q.question_id || `${q.question_text?.substring(0, 50)}...`
      
      if (!questionFailureStats[questionKey]) {
        questionFailureStats[questionKey] = {
          questionId: q.question_id,
          questionText: q.question_text?.substring(0, 100) + (q.question_text?.length > 100 ? '...' : ''),
          totalAttempts: 0,
          incorrectAttempts: 0,
          correctAttempts: 0,
          uniqueUsersWrong: new Set(),
          uniqueUsersCorrect: new Set(),
          uniqueTests: new Set(),
          avgTimeSpent: 0,
          totalTimeSpent: 0,
          lowConfidenceCount: 0,
          article: q.article_number || 'Sin artículo',
          law: q.law_name || 'Sin ley'
        }
      }

      const stats = questionFailureStats[questionKey]
      stats.totalAttempts++
      stats.uniqueTests.add(q.test_id)
      stats.totalTimeSpent += (q.time_spent_seconds || 0)
      
      if (['unsure', 'guessing'].includes(q.confidence_level)) {
        stats.lowConfidenceCount++
      }
      
      if (q.is_correct === false) {
        stats.incorrectAttempts++
        stats.uniqueUsersWrong.add(q.tests.user_id)
      } else if (q.is_correct === true) {
        stats.correctAttempts++
        stats.uniqueUsersCorrect.add(q.tests.user_id)
      }
    })

    const frequentlyFailedQuestions = Object.values(questionFailureStats)
      .filter(q => q.totalAttempts >= 3 && q.uniqueUsersWrong.size >= 2) // Al menos 3 intentos y 2 usuarios distintos fallaron
      .map(q => ({
        ...q,
        failureRate: Math.round((q.incorrectAttempts / q.totalAttempts) * 100),
        avgTimeSpent: q.totalAttempts > 0 ? Math.round(q.totalTimeSpent / q.totalAttempts) : 0,
        uniqueUsersWrongCount: q.uniqueUsersWrong.size,
        uniqueUsersCorrectCount: q.uniqueUsersCorrect.size,
        uniqueTestsCount: q.uniqueTests.size,
        lowConfidenceRate: Math.round((q.lowConfidenceCount / q.totalAttempts) * 100)
      }))
      .filter(q => q.failureRate >= 60) // Al menos 60% de fallos
      .sort((a, b) => b.uniqueUsersWrongCount - a.uniqueUsersWrongCount) // Ordenar por usuarios únicos que fallaron

    // 🔍 FILTRAR: Solo preguntas que NO están en tracking como resolved
    const { data: trackedQuestions } = await supabase
      .from('problematic_questions_tracking')
      .select('question_id, status')
      .eq('status', 'resolved')

    // 🔍 OBTENER: Datos completos de preguntas para el modal
    const questionIds = [
      ...problematicQuestions.map(q => q.questionId),
      ...frequentlyFailedQuestions.map(q => q.questionId)
    ].filter(Boolean)

    const { data: fullQuestionData } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        option_a,
        option_b, 
        option_c,
        option_d,
        correct_option,
        explanation,
        primary_article_id,
        articles!inner(article_number, title, law_id, laws!inner(name, short_name))
      `)
      .in('id', questionIds)

    // 📝 OBTENER: Historial de revisiones previas
    const { data: reviewHistory } = await supabase
      .from('problematic_questions_tracking')
      .select(`
        id,
        question_id,
        detection_type,
        status,
        resolved_at,
        admin_notes,
        resolution_action,
        failure_rate,
        abandonment_rate,
        users_affected,
        detected_at,
        admin_users_with_roles!inner(user_id, full_name, email)
      `)
      .in('question_id', questionIds)
      .order('detected_at', { ascending: false })

    const questionDataMap = new Map(fullQuestionData?.map(q => [q.id, q]) || [])
    const reviewHistoryMap = new Map()
    
    // Agrupar historial por question_id
    reviewHistory?.forEach(review => {
      if (!reviewHistoryMap.has(review.question_id)) {
        reviewHistoryMap.set(review.question_id, [])
      }
      reviewHistoryMap.get(review.question_id).push(review)
    })

    const resolvedQuestionIds = new Set(trackedQuestions?.map(t => t.question_id) || [])

    // Filtrar preguntas ya resueltas y agregar datos completos
    const filteredProblematicQuestions = problematicQuestions
      .filter(q => q.questionId && !resolvedQuestionIds.has(q.questionId))
      .map(q => ({ 
        ...q, 
        fullData: questionDataMap.get(q.questionId),
        reviewHistory: reviewHistoryMap.get(q.questionId) || []
      }))

    const filteredFrequentlyFailedQuestions = frequentlyFailedQuestions
      .filter(q => q.questionId && !resolvedQuestionIds.has(q.questionId))
      .map(q => ({ 
        ...q, 
        fullData: questionDataMap.get(q.questionId),
        reviewHistory: reviewHistoryMap.get(q.questionId) || []
      }))

    return {
      summary: {
        totalTests: tests.length,
        completedTests: completed.length,
        abandonedTests: abandoned.length,
        abandonmentRate: tests.length > 0 ? Math.round((abandoned.length / tests.length) * 100) : 0,
        totalUsers: usersArray.length,
        activeUsers: usersArray.filter(u => u.isActiveStudent).length
      },
      users: {
        all: usersArray.sort((a, b) => b.totalTests - a.totalTests),
        power: powerUsers,
        risk: riskUsers,
        normal: normalUsers
      },
      abandonment: {
        points: abandonmentPoints,
        avgQuestionsBeforeAbandon: Object.values(testAbandonmentData).length > 0 
          ? Math.round(Object.values(testAbandonmentData).reduce((a, b) => a + b, 0) / Object.values(testAbandonmentData).length)
          : 0
      },
      content: {
        problematicArticles: problematicArticles.slice(0, 10),
        problematicQuestions: filteredProblematicQuestions.slice(0, 15),
        frequentlyFailedQuestions: filteredFrequentlyFailedQuestions.slice(0, 15)
      }
    }
  }

  function getQuestionRange(questionNumber) {
    if (questionNumber <= 5) return "1-5 (Inicio)"
    if (questionNumber <= 10) return "6-10 (Temprano)"
    if (questionNumber <= 15) return "11-15 (Medio)"
    if (questionNumber <= 20) return "16-20 (Avanzado)"
    return "21+ (Final)"
  }

  const markQuestionAsReviewed = (questionId, detectionType, questionData) => {
    console.log('🔍 Abriendo modal para:', { questionId, detectionType, questionData })
    setReviewModal({
      isOpen: true,
      question: { questionId, ...questionData },
      detectionType
    })
  }

  const handleReviewSubmit = async (reviewData) => {
    if (!supabase || !reviewModal.question) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('problematic_questions_tracking')
        .insert({
          question_id: reviewModal.question.questionId,
          detection_type: reviewModal.detectionType,
          failure_rate: reviewModal.question.failureRate || null,
          abandonment_rate: reviewModal.question.abandonmentRate || null,
          users_affected: reviewModal.question.uniqueUsersWrongCount || reviewModal.question.uniqueUsersAbandonedCount,
          total_attempts: reviewModal.question.totalAttempts || reviewModal.question.totalAppearances,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          admin_notes: reviewData.notes,
          resolution_action: reviewData.action,
          redetection_threshold_users: reviewData.threshold || 5
        })

      if (error) throw error

      // Recargar analytics para quitar la pregunta de la lista
      window.location.reload()
      
      setReviewModal({ isOpen: false, question: null, detectionType: null })
      alert('✅ Pregunta marcada como revisada exitosamente')
      
    } catch (error) {
      console.error('Error marcando pregunta como revisada:', error)
      alert('❌ Error: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📊 Analizando patrones de comportamiento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error cargando analytics</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }

  if (!analyticsData) {
    return <div>No hay datos disponibles</div>
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📈 Analytics Detallados
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Análisis completo de comportamiento y abandono de usuarios
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 Actualizar
          </button>
          <a 
            href="/admin" 
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            ← Dashboard
          </a>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tests</p>
              <p className="text-2xl font-bold text-blue-600">{analyticsData.summary.totalTests}</p>
            </div>
            <span className="text-3xl">📊</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Tests realizados en total</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completados</p>
              <p className="text-2xl font-bold text-green-600">{analyticsData.summary.completedTests}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Tests finalizados exitosamente</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abandonados</p>
              <p className="text-2xl font-bold text-red-600">{analyticsData.summary.abandonedTests}</p>
            </div>
            <span className="text-3xl">💔</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Tests iniciados pero no terminados</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tasa Abandono</p>
              <p className="text-2xl font-bold text-orange-600">{analyticsData.summary.abandonmentRate}%</p>
            </div>
            <span className="text-3xl">📉</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Porcentaje de tests abandonados</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Usuarios Activos</p>
              <p className="text-2xl font-bold text-purple-600">{analyticsData.summary.activeUsers}</p>
            </div>
            <span className="text-3xl">🔥</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">De {analyticsData.summary.totalUsers} usuarios totales</p>
        </div>
      </div>

      {/* Puntos de abandono */}
      {analyticsData.abandonment.points && Object.keys(analyticsData.abandonment.points).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🎯 ¿En qué momento abandonan los tests?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.entries(analyticsData.abandonment.points).map(([range, count]) => (
              <div key={range} className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 mb-2">{count}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{range}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((count / analyticsData.summary.abandonedTests) * 100)}% del total
                </div>
              </div>
            ))}
          </div>
          {analyticsData.abandonment.avgQuestionsBeforeAbandon > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📊 <strong>Promedio:</strong> Los usuarios abandonan en la pregunta {analyticsData.abandonment.avgQuestionsBeforeAbandon}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Usuarios en riesgo */}
      {analyticsData.users.risk.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ⚠️ Usuarios en Riesgo ({analyticsData.users.risk.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyticsData.users.risk.map((user, index) => (
              <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">{user.abandonmentRate}%</div>
                    <div className="text-sm text-gray-500">{user.totalTests} tests</div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  {user.totalTests === 0 ? (
                    <span className="text-red-600">🚨 Sin actividad - Email de reactivación urgente</span>
                  ) : user.abandonmentRate > 75 ? (
                    <span className="text-orange-600">🎯 Apoyo personalizado requerido</span>
                  ) : (
                    <span className="text-yellow-600">📧 Motivación y recordatorios</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power Users */}
      {analyticsData.users.power.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🏆 Power Users ({analyticsData.users.power.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analyticsData.users.power.map((user, index) => (
              <div key={index} className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                    <div className="text-sm text-green-600">{user.completionRate}% completion</div>
                    <div className="text-xs text-gray-500">{user.totalTests} tests • {user.avgAccuracy}% accuracy</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              🎯 <strong>Modelo a seguir:</strong> Estos usuarios muestran el comportamiento ideal. Analiza sus patrones para mejorar el onboarding.
            </p>
          </div>
        </div>
      )}

      {/* 🚨 NUEVA SECCIÓN: Preguntas específicas con mayor abandono */}
      {analyticsData.content.problematicQuestions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🚨 Preguntas que Causan Más Abandono ({analyticsData.content.problematicQuestions.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Preguntas específicas <strong>activas</strong> donde múltiples usuarios abandonan el test. <strong>Estas pueden tener errores o ser confusas.</strong>
          </p>
          <div className="space-y-4">
            {analyticsData.content.problematicQuestions.map((question, index) => (
              <div key={index} className="border border-red-200 dark:border-red-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-red-600 font-bold text-lg">#{index + 1}</span>
                      <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                        {question.uniqueUsersAbandonedCount} usuarios abandonaron
                      </span>
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                        {question.abandonmentRate}% abandono
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-900 dark:text-white mb-2 font-medium">
                      {question.questionText || 'Texto de pregunta no disponible'}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>📍 {question.law} - Art. {question.article}</span>
                      <span>📊 {question.totalAppearances} apariciones</span>
                      <span>⭐ Pregunta promedio #{question.avgQuestionOrder}</span>
                      <span>🧪 {question.uniqueTestsCount} tests únicos</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-red-600 font-medium mb-1">ACCIÓN REQUERIDA</div>
                    {question.abandonmentRate >= 70 ? (
                      <div className="text-xs text-red-800 bg-red-200 px-2 py-1 rounded mb-2">
                        🔧 REVISAR URGENTE
                      </div>
                    ) : question.abandonmentRate >= 50 ? (
                      <div className="text-xs text-orange-800 bg-orange-200 px-2 py-1 rounded mb-2">
                        ⚠️ VERIFICAR CONTENIDO
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-800 bg-yellow-200 px-2 py-1 rounded mb-2">
                        👀 MONITOREAR
                      </div>
                    )}
                    
                    {question.questionId ? (
                      <>
                        <button
                          onClick={() => {
                            console.log('🟡 Botón abandono clickeado:', question.questionId, question)
                            markQuestionAsReviewed(question.questionId, 'high_abandonment', question)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded mb-1 block w-full transition-colors"
                        >
                          🔍 Revisar
                        </button>
                        <div className="text-xs text-gray-500">
                          ID: {question.questionId}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">
                        ❌ Sin ID
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>💡 Recomendaciones:</strong> Estas preguntas requieren revisión inmediata. Pueden tener:
            </p>
            <ul className="text-sm text-red-700 dark:text-red-300 mt-2 ml-4 list-disc">
              <li>Respuestas incorrectas o ambiguas</li>
              <li>Enunciados confusos o mal redactados</li>
              <li>Referencias a artículos derogados</li>
              <li>Dificultad excesiva para su posición en el test</li>
            </ul>
          </div>
        </div>
      )}

      {/* 🎯 NUEVA SECCIÓN: Preguntas falladas frecuentemente */}
      {analyticsData.content.frequentlyFailedQuestions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🎯 Preguntas Falladas Frecuentemente ({analyticsData.content.frequentlyFailedQuestions.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Preguntas <strong>activas</strong> con alta tasa de error que múltiples usuarios fallan. <strong>Pueden tener respuestas incorrectas o ser excesivamente difíciles.</strong>
          </p>
          <div className="space-y-4">
            {analyticsData.content.frequentlyFailedQuestions.map((question, index) => (
              <div key={index} className="border border-orange-200 dark:border-orange-700 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-orange-600 font-bold text-lg">#{index + 1}</span>
                      <span className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                        {question.uniqueUsersWrongCount} usuarios fallaron
                      </span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                        {question.failureRate}% error
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {question.avgTimeSpent}s promedio
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-900 dark:text-white mb-2 font-medium">
                      {question.questionText || 'Texto de pregunta no disponible'}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>📍 {question.law} - Art. {question.article}</span>
                      <span>📊 {question.totalAttempts} intentos totales</span>
                      <span>❌ {question.incorrectAttempts} fallos</span>
                      <span>✅ {question.correctAttempts} aciertos</span>
                      <span>🧪 {question.uniqueTestsCount} tests</span>
                      {question.lowConfidenceRate > 0 && (
                        <span>😰 {question.lowConfidenceRate}% baja confianza</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-orange-600 font-medium mb-1">REVISAR CONTENIDO</div>
                    {question.failureRate >= 80 ? (
                      <div className="text-xs text-red-800 bg-red-200 px-2 py-1 rounded mb-2">
                        🚨 CRÍTICO
                      </div>
                    ) : question.failureRate >= 70 ? (
                      <div className="text-xs text-orange-800 bg-orange-200 px-2 py-1 rounded mb-2">
                        ⚠️ REVISAR RESPUESTA
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-800 bg-yellow-200 px-2 py-1 rounded mb-2">
                        📝 MEJORAR EXPLICACIÓN
                      </div>
                    )}
                    
                    {question.questionId ? (
                      <>
                        <button
                          onClick={() => {
                            console.log('🔴 Botón fallos clickeado:', question.questionId, question)
                            markQuestionAsReviewed(question.questionId, 'frequent_fails', question)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded mb-1 block w-full transition-colors"
                        >
                          🔍 Revisar
                        </button>
                        <div className="text-xs text-gray-500">
                          ID: {question.questionId}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">
                        ❌ Sin ID
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Ratio de éxito vs fallo */}
                <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span>{question.uniqueUsersWrongCount} fallaron</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>{question.uniqueUsersCorrectCount} acertaron</span>
                      </div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Ratio: {question.uniqueUsersWrongCount}:{question.uniqueUsersCorrectCount}
                    </div>
                  </div>
                  
                  {/* Barra visual de proporción */}
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{
                        width: `${Math.min(100, (question.uniqueUsersWrongCount / (question.uniqueUsersWrongCount + question.uniqueUsersCorrectCount)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>💡 Posibles causas:</strong> Estas preguntas requieren revisión del contenido:
            </p>
            <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 ml-4 list-disc">
              <li>Respuesta marcada como correcta es incorrecta</li>
              <li>Múltiples respuestas válidas sin especificar "la más correcta"</li>
              <li>Enunciado ambiguo o mal interpretable</li>
              <li>Dificultad excesiva para el nivel del examen</li>
              <li>Información desactualizada o derogada</li>
            </ul>
          </div>
        </div>
      )}

      {/* Contenido problemático */}
      {analyticsData.content.problematicArticles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📚 Artículos que Causan Más Abandono
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intentos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accuracy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abandono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analyticsData.content.problematicArticles.map((article, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {article.law} - Art. {article.article}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {article.totalAttempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        article.accuracy >= 70 ? 'bg-green-100 text-green-800' :
                        article.accuracy >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {article.accuracy}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        article.abandonmentRate >= 50 ? 'bg-red-100 text-red-800' :
                        article.abandonmentRate >= 30 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {article.abandonmentRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {article.abandonmentRate >= 50 ? (
                        <span className="text-red-600">🔧 Revisar urgente</span>
                      ) : article.accuracy < 50 ? (
                        <span className="text-orange-600">📝 Mejorar explicación</span>
                      ) : (
                        <span className="text-blue-600">👀 Monitorear</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla completa de usuarios */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          👥 Análisis Completo de Usuarios
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accuracy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {analyticsData.users.all.map((user, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.totalTests} ({user.completed}✅/{user.abandoned}💔)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.completionRate >= 80 ? 'bg-green-100 text-green-800' :
                      user.completionRate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.completionRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.avgAccuracy >= 80 ? 'bg-green-100 text-green-800' :
                      user.avgAccuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      user.avgAccuracy > 0 ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.avgAccuracy > 0 ? `${user.avgAccuracy}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {analyticsData.users.power.includes(user) ? (
                      <span className="text-green-600">🏆 Power User</span>
                    ) : analyticsData.users.risk.includes(user) ? (
                      <span className="text-red-600">⚠️ En Riesgo</span>
                    ) : user.isActiveStudent ? (
                      <span className="text-blue-600">👤 Activo</span>
                    ) : (
                      <span className="text-gray-600">😴 Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de revisión */}
      {reviewModal.isOpen && (
        <ReviewModal
          question={reviewModal.question}
          detectionType={reviewModal.detectionType}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewModal({ isOpen: false, question: null, detectionType: null })}
          submitting={submitting}
        />
      )}

    </div>
  )
}

// Componente Modal de Revisión
function ReviewModal({ question, detectionType, onSubmit, onClose, submitting }) {
  const [notes, setNotes] = useState('')
  const [action, setAction] = useState('')
  const [threshold, setThreshold] = useState(5)

  console.log('🎯 Modal datos recibidos:', { question, detectionType })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!action) {
      alert('Por favor selecciona una acción tomada')
      return
    }
    onSubmit({ notes, action, threshold })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">📝 Marcar Pregunta como Revisada</h3>
            <p className="text-blue-100 text-sm">
              {detectionType === 'frequent_fails' ? '🎯 Pregunta Fallada Frecuentemente' : '🚨 Pregunta con Alto Abandono'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white font-bold">×</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* Info de la pregunta completa */}
          <div className="space-y-6">
            {/* Cabecera con métricas */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-red-800 dark:text-red-200">⚠️ Pregunta Problemática</h4>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">ID: {question.questionId}</span>
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                <strong>Métrica:</strong> {
                  detectionType === 'frequent_fails' 
                    ? `${question.failureRate}% fallos (${question.uniqueUsersWrongCount} usuarios únicos)`
                    : `${question.abandonmentRate}% abandono (${question.uniqueUsersAbandonedCount} usuarios únicos)`
                }
              </div>
            </div>

            {/* Pregunta completa */}
            {question.fullData && (
              <>
                {/* Enunciado */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-bold text-blue-800 dark:text-blue-200 mb-3">❓ Enunciado</h5>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {question.fullData.question_text}
                  </p>
                </div>

                {/* Opciones de respuesta */}
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4">
                  <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-3">📝 Opciones de Respuesta</h5>
                  <div className="space-y-2">
                    {['a', 'b', 'c', 'd'].map((letter, index) => {
                      const optionKey = `option_${letter}`
                      const isCorrect = question.fullData.correct_option === index
                      return (
                        <div 
                          key={letter}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect 
                              ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-200'
                              : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200'
                          }`}
                        >
                          <span className="font-bold uppercase mr-2">{letter})</span>
                          {question.fullData[optionKey]}
                          {isCorrect && <span className="ml-2 text-green-600">✅ CORRECTA</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Explicación */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4">
                  <h5 className="font-bold text-yellow-800 dark:text-yellow-200 mb-3">💡 Explicación</h5>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {question.fullData.explanation || 'Sin explicación disponible'}
                  </p>
                </div>

                {/* Artículo y Ley */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded-lg p-4">
                  <h5 className="font-bold text-purple-800 dark:text-purple-200 mb-3">📚 Marco Legal</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300">Ley:</strong>
                      <div className="text-gray-700 dark:text-gray-300">
                        {question.fullData.articles?.laws?.name || 'No disponible'}
                        {question.fullData.articles?.laws?.short_name && 
                          ` (${question.fullData.articles.laws.short_name})`
                        }
                      </div>
                    </div>
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300">Artículo:</strong>
                      <div className="text-gray-700 dark:text-gray-300">
                        Art. {question.fullData.articles?.article_number || 'No disponible'}
                        {question.fullData.articles?.title && 
                          ` - ${question.fullData.articles.title}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!question.fullData && (
              <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  ⚠️ No se pudieron cargar los datos completos de la pregunta
                </p>
              </div>
            )}

            {/* Historial de revisiones previas */}
            {question.reviewHistory && question.reviewHistory.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-4">
                <h5 className="font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center">
                  📜 Historial de Revisiones ({question.reviewHistory.length})
                </h5>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {question.reviewHistory.map((review, index) => (
                    <div key={review.id} className="bg-white dark:bg-gray-600 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            review.status === 'resolved' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                              : review.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {review.status === 'resolved' ? '✅ Resuelto' : 
                             review.status === 'pending' ? '⏳ Pendiente' : 
                             review.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            #{question.reviewHistory.length - index}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.detected_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <strong className="text-amber-700 dark:text-amber-300">Tipo:</strong>
                          <span className="ml-1 text-gray-700 dark:text-gray-300">
                            {review.detection_type === 'frequent_fails' ? '🎯 Fallos frecuentes' : '🚨 Alto abandono'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-amber-700 dark:text-amber-300">Métrica:</strong>
                          <span className="ml-1 text-gray-700 dark:text-gray-300">
                            {review.detection_type === 'frequent_fails' 
                              ? `${review.failure_rate}% fallos`
                              : `${review.abandonment_rate}% abandono`
                            } ({review.users_affected} usuarios)
                          </span>
                        </div>
                      </div>

                      {review.status === 'resolved' && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <div className="text-xs">
                            <div className="mb-1">
                              <strong className="text-green-700 dark:text-green-300">Admin:</strong>
                              <span className="ml-1 text-gray-700 dark:text-gray-300">
                                {review.admin_users_with_roles?.full_name || 'Admin desconocido'}
                              </span>
                            </div>
                            {review.resolution_action && (
                              <div className="mb-1">
                                <strong className="text-green-700 dark:text-green-300">Acción:</strong>
                                <span className="ml-1 text-gray-700 dark:text-gray-300">
                                  {review.resolution_action === 'question_fixed' ? '✅ Pregunta corregida' :
                                   review.resolution_action === 'answer_corrected' ? '🔧 Respuesta corregida' :
                                   review.resolution_action === 'explanation_improved' ? '📝 Explicación mejorada' :
                                   review.resolution_action === 'question_deactivated' ? '❌ Pregunta desactivada' :
                                   review.resolution_action === 'no_action_needed' ? '👌 No requería acción' :
                                   review.resolution_action === 'monitoring_required' ? '👀 Requiere monitoreo' :
                                   review.resolution_action}
                                </span>
                              </div>
                            )}
                            {review.admin_notes && (
                              <div>
                                <strong className="text-green-700 dark:text-green-300">Notas:</strong>
                                <p className="ml-1 text-gray-700 dark:text-gray-300 italic">
                                  "{review.admin_notes}"
                                </p>
                              </div>
                            )}
                            {review.resolved_at && (
                              <div className="text-xs text-gray-500 mt-1">
                                Resuelto el {new Date(review.resolved_at).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="border-t border-gray-300 dark:border-gray-600 my-6"></div>

          {/* Formulario de revisión */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              🔧 Formulario de Revisión
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
            {/* Acción tomada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔧 ¿Qué acción tomaste?
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">Selecciona una acción...</option>
                <option value="question_fixed">✅ Pregunta corregida</option>
                <option value="answer_corrected">🔧 Respuesta corregida</option>
                <option value="explanation_improved">📝 Explicación mejorada</option>
                <option value="question_deactivated">❌ Pregunta desactivada</option>
                <option value="no_action_needed">👌 No requiere acción (falso positivo)</option>
                <option value="monitoring_required">👀 Requiere monitoreo adicional</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📝 Notas de revisión (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Describe qué encontraste y qué acción tomaste..."
              />
            </div>

            {/* Umbral de re-detección */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔄 Umbral para re-detección (usuarios adicionales que la fallen)
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                La pregunta volverá a aparecer si {threshold} usuarios más la fallan después de esta revisión
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? '⏳ Guardando...' : '✅ Marcar como Revisada'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
