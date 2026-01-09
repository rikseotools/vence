// app/test-recuperado/page.js
// Página para recuperar y mostrar tests guardados antes del registro
// Usa Drizzle + Zod API layer
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

const PENDING_TEST_KEY = 'vence_pending_test'
const RECOVERY_SESSION_KEY = 'vence_recovery_result' // Para persistir entre recargas

function TestRecuperadoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [status, setStatus] = useState('loading') // loading, success, error, no-test
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // Guard contra doble ejecución

  // Log de cada render para debug
  console.log('🖼️ [RECUPERADO] RENDER - status:', status, 'testResult:', testResult ? 'EXISTS' : 'null', 'isProcessing:', isProcessing)

  useEffect(() => {
    console.log('🔄 [RECUPERADO] useEffect ejecutado', {
      authLoading,
      user: user?.id || 'null',
      status,
      hasTestResult: !!testResult,
      isProcessing
    })

    // Si ya tenemos éxito, no hacer nada más
    if (status === 'success' && testResult) {
      console.log('✅ [RECUPERADO] Ya tenemos resultado, ignorando effect')
      return
    }

    if (authLoading) {
      console.log('⏳ [RECUPERADO] Esperando auth...')
      return
    }

    // 🔒 Verificar si ya tenemos resultado guardado en sessionStorage (persiste entre recargas)
    const savedResult = sessionStorage.getItem(RECOVERY_SESSION_KEY)
    console.log('📦 [RECUPERADO] sessionStorage check:', savedResult ? 'FOUND' : 'EMPTY')

    if (savedResult) {
      try {
        const parsed = JSON.parse(savedResult)
        console.log('✅ [RECUPERADO] Usando resultado guardado de sesión:', parsed)
        setTestResult(parsed.testResult)
        setNeedsOnboarding(parsed.needsOnboarding || false)
        setStatus('success')
        return
      } catch (e) {
        console.log('❌ [RECUPERADO] Error parseando sessionStorage:', e)
        sessionStorage.removeItem(RECOVERY_SESSION_KEY)
      }
    }

    // Guard contra doble ejecución
    if (isProcessing) {
      console.log('🛑 [RECUPERADO] Ya hay un proceso en curso, ignorando...')
      return
    }

    const processRecoveredTest = async () => {
      console.log('🚀 [RECUPERADO] processRecoveredTest iniciado')
      setIsProcessing(true)
      try {
        // Verificar que el usuario esté logueado
        if (!user) {
          console.log('❌ [RECUPERADO] Usuario no autenticado, redirigiendo a login')
          router.push('/login')
          return
        }

        // Obtener test pendiente de localStorage
        const pendingTestStr = localStorage.getItem(PENDING_TEST_KEY)
        console.log('📂 [RECUPERADO] localStorage check:', pendingTestStr ? `FOUND (${pendingTestStr.length} chars)` : 'EMPTY')

        if (!pendingTestStr) {
          console.log('❌ [RECUPERADO] No hay test pendiente en localStorage - CAMBIANDO A no-test')
          setStatus('no-test')
          return
        }

        let pendingTest
        try {
          pendingTest = JSON.parse(pendingTestStr)
        } catch (e) {
          console.error('❌ [RECUPERADO] Error parseando test:', e)
          localStorage.removeItem(PENDING_TEST_KEY)
          setStatus('no-test')
          return
        }

        console.log('🎯 [RECUPERADO] Test encontrado:', {
          tema: pendingTest.tema,
          preguntas: pendingTest.answeredQuestions?.length,
          score: pendingTest.score
        })

        // Verificar que tenga respuestas
        if (!pendingTest.answeredQuestions || pendingTest.answeredQuestions.length === 0) {
          console.log('❌ [RECUPERADO] Test sin respuestas')
          localStorage.removeItem(PENDING_TEST_KEY)
          setStatus('no-test')
          return
        }

        // Llamar al API con Drizzle + Zod
        const response = await fetch('/api/tests/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            pendingTest: pendingTest,
          }),
        })

        const result = await response.json()

        if (!result.success) {
          console.error('❌ [RECUPERADO] Error del API:', result.error)
          // Si es error de validación, limpiar localStorage y mostrar error
          if (result.details) {
            console.error('Detalles de validación:', result.details)
          }
          setError(result.error || 'Error guardando el test')
          setStatus('error')
          return
        }

        console.log('✅ [RECUPERADO] Test guardado via API:', result.testId)

        // 🔒 PRIMERO: Guardar en sessionStorage ANTES de eliminar localStorage
        // Esto es crucial para que si el componente se remonta, encuentre el resultado
        const recoveryData = {
          testResult: {
            testId: result.testId,
            tema: result.tema,
            totalQuestions: result.totalQuestions,
            correctAnswers: result.correctAnswers,
            incorrectAnswers: result.incorrectAnswers,
            percentage: result.percentage,
            totalTimeSeconds: result.totalTimeSeconds,
            pageUrl: pendingTest.pageUrl,
          },
          needsOnboarding: result.needsOnboarding || false
        }
        sessionStorage.setItem(RECOVERY_SESSION_KEY, JSON.stringify(recoveryData))
        console.log('💾 [RECUPERADO] 1. sessionStorage guardado PRIMERO')

        // Verificar que sessionStorage se guardó
        const checkSession = sessionStorage.getItem(RECOVERY_SESSION_KEY)
        console.log('🔍 [RECUPERADO] Verificación: sessionStorage tiene:', checkSession ? `${checkSession.length} chars` : 'NADA!')

        // 🗑️ SEGUNDO: Ahora sí, limpiar localStorage
        localStorage.removeItem(PENDING_TEST_KEY)
        console.log('🗑️ [RECUPERADO] 2. localStorage limpiado')

        // Verificar que se eliminó
        const checkRemoved = localStorage.getItem(PENDING_TEST_KEY)
        console.log('🔍 [RECUPERADO] Verificación: localStorage ahora es:', checkRemoved ? 'AÚN EXISTE!' : 'ELIMINADO OK')

        // 🎯 TERCERO: Establecer estado React
        console.log('🎯 [RECUPERADO] 3. Estableciendo estado React')
        setTestResult(recoveryData.testResult)
        setNeedsOnboarding(recoveryData.needsOnboarding)
        setStatus('success')
        console.log('✅ [RECUPERADO] 4. Estado establecido correctamente')

      } catch (err) {
        console.error('❌ [RECUPERADO] Error procesando test:', err)
        setError(err.message)
        setStatus('error')
      } finally {
        // No reseteamos isProcessing para evitar múltiples ejecuciones
        console.log('🏁 [RECUPERADO] processRecoveredTest finalizado')
      }
    }

    processRecoveredTest()
  }, [user, authLoading, router, isProcessing])

  // Loading state
  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            Recuperando tu test...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Guardando tu progreso en tu cuenta
          </p>
        </div>
      </div>
    )
  }

  // No test found
  if (status === 'no-test') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            No encontramos ningún test pendiente
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Puede que ya se haya guardado o haya expirado.
          </p>
          <Link
            href="/auxiliar-administrativo-estado"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Ir a hacer tests
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-6">😕</div>
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-3">
            Hubo un problema
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'No pudimos recuperar tu test'}
          </p>
          <Link
            href="/auxiliar-administrativo-estado"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Continuar practicando
          </Link>
        </div>
      </div>
    )
  }

  // Success state - Show result
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            ¡Tu test ha sido guardado!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gracias por registrarte. Aquí tienes tu resultado:
          </p>
        </div>

        {/* Result Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <div className={`text-5xl font-bold mb-2 ${
              testResult.percentage >= 70 ? 'text-green-600' :
              testResult.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {testResult.percentage}%
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              Tema {testResult.tema}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {testResult.totalQuestions}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Preguntas
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {testResult.correctAnswers}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Correctas
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {testResult.incorrectAnswers}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Incorrectas
              </div>
            </div>
          </div>

          {testResult.totalTimeSeconds > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Tiempo: {Math.floor(testResult.totalTimeSeconds / 60)}:{String(testResult.totalTimeSeconds % 60).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Feedback message */}
        <div className={`rounded-lg p-4 mb-6 ${
          testResult.percentage >= 70
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : testResult.percentage >= 50
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          <p className="text-center">
            {testResult.percentage >= 70
              ? '¡Excelente resultado! Sigue así y aprobarás la oposición.'
              : testResult.percentage >= 50
              ? 'Buen intento. Con más práctica mejorarás.'
              : 'No te desanimes. La práctica hace al maestro.'}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          {needsOnboarding ? (
            <>
              <Link
                href="/onboarding"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-4 rounded-lg transition-colors text-center"
              >
                Configurar mi oposición
              </Link>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Selecciona tu oposición para personalizar tu experiencia
              </p>
            </>
          ) : (
            <Link
              href={testResult.pageUrl || '/auxiliar-administrativo-estado'}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-4 rounded-lg transition-colors text-center"
            >
              Continuar practicando
            </Link>
          )}

          <Link
            href="/"
            className="block w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium px-6 py-3 rounded-lg transition-colors text-center"
          >
            Ir al inicio
          </Link>
        </div>

        {/* Benefits reminder */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            Ahora que tienes cuenta:
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>✅ Tu progreso se guarda automáticamente</li>
            <li>✅ Accede desde cualquier dispositivo</li>
            <li>✅ Estadísticas detalladas de tu rendimiento</li>
            <li>✅ Recomendaciones personalizadas</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function TestRecuperadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            Cargando...
          </h2>
        </div>
      </div>
    }>
      <TestRecuperadoContent />
    </Suspense>
  )
}
