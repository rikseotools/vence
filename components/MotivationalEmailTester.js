// components/MotivationalEmailTester.js
// Componente para probar el sistema de emails motivacionales desde el navegador
'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function MotivationalEmailTester() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [showComponent, setShowComponent] = useState(false)

  // Solo mostrar en desarrollo y para admins
  if (process.env.NODE_ENV !== 'development' || !user || user.email !== 'ilovetestpro@gmail.com') {
    return null
  }

  const testNotifications = [
    {
      id: 'daily_progress',
      name: 'Progreso Diario',
      type: 'daily_progress',
      title: '📈 Progreso Constante - TEST',
      body: '¡Llevas 5 días consecutivos estudiando! Has completado 47 preguntas esta semana. ¿Continuamos con el buen ritmo?',
      primaryAction: {
        label: '🚀 Mantener Racha (5 min)',
        type: 'maintain_streak'
      },
      secondaryAction: {
        label: '📈 Ver Racha Completa',
        type: 'view_streak_stats'
      },
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'accuracy_improvement',
      name: 'Mejora de Precisión',
      type: 'accuracy_improvement',
      title: '🎯 Mejora Detectada - TEST',
      body: 'Tu precisión en Tema 7 ha mejorado del 67% al 82% esta semana. ¡Excelente progreso!',
      primaryAction: {
        label: '🔥 Test Intensivo (10 preguntas)',
        type: 'intensive_test'
      },
      secondaryAction: {
        label: '📖 Ver Teoría',
        type: 'view_theory'
      },
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      id: 'constructive_encouragement',
      name: 'Ánimo Constructivo',
      type: 'constructive_encouragement', 
      title: '🤗 Momento de Reflexión - TEST',
      body: 'Recuerda que ya has dominado 12 artículos y tu mejor racha fue de 8 días. El progreso general está en 68%. Te recomendamos repasar Tema 3.',
      primaryAction: {
        label: '💪 Test de Refuerzo (5 min)',
        type: 'directed_test'
      },
      secondaryAction: {
        label: '📈 Ver Progreso',  
        type: 'view_progress'
      },
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    {
      id: 'positive_acceleration',
      name: 'Aceleración Positiva',
      type: 'positive_acceleration',
      title: '⚡ Plan de Aceleración - TEST',
      body: 'Con solo 15 minutos más al día puedes alcanzar el 75% de preparación. Te recomendamos 8 preguntas diarias durante 3 semanas.',
      primaryAction: {
        label: '🚀 Plan de 15 Minutos',
        type: 'quick_test'
      },
      secondaryAction: {
        label: '📊 Ver Plan Detallado',
        type: 'view_stats'
      },
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    {
      id: 'articles_mastered',
      name: 'Artículos Dominados',
      type: 'articles_mastered',
      title: '🏆 Nuevos Dominios - TEST', 
      body: 'Has dominado 3 nuevos artículos esta semana: LPAC Art. 14 (89%), LRJSP Art. 25 (92%), CE Art. 103 (87%)',
      primaryAction: {
        label: '🎯 Próximo Desafío',
        type: 'next_challenge'
      },
      secondaryAction: {
        label: '🏆 Ver Logros',
        type: 'view_achievements'
      },
      color: 'bg-orange-100 text-orange-800 border-orange-200'
    }
  ]

  const sendTestEmail = async (notification) => {
    setLoading(notification.id)
    
    try {
      const response = await fetch('/api/send-motivational-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.user_metadata?.full_name || 'Test User',
          messageType: notification.type,
          title: notification.title,
          body: notification.body,
          primaryAction: notification.primaryAction,
          secondaryAction: notification.secondaryAction,
          userId: user.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        setResults(prev => [...prev, {
          id: notification.id,
          name: notification.name,
          status: 'success',
          emailId: result.emailId,
          message: result.message,
          timestamp: new Date().toISOString()
        }])
      } else {
        setResults(prev => [...prev, {
          id: notification.id,
          name: notification.name,
          status: 'error',
          error: result.error,
          timestamp: new Date().toISOString()
        }])
      }
    } catch (error) {
      setResults(prev => [...prev, {
        id: notification.id,
        name: notification.name,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  const sendAllTests = async () => {
    setResults([])
    for (const notification of testNotifications) {
      await sendTestEmail(notification)
      // Esperar un poco entre emails para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  const clearResults = () => {
    setResults([])
  }

  if (!showComponent) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setShowComponent(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
        >
          🧪 Test Emails
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">🧪 Test de Emails Motivacionales</h2>
              <p className="text-gray-600 mt-1">Prueba el sistema de email fallback</p>
            </div>
            <button
              onClick={() => setShowComponent(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={sendAllTests}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '⏳ Enviando...' : '📧 Enviar Todos los Tests'}
            </button>
            <button
              onClick={clearResults}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              🗑️ Limpiar Resultados
            </button>
            <a
              href="/admin/notificaciones/email"
              target="_blank"
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              📊 Ver Admin Panel
            </a>
          </div>

          {/* Individual Tests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testNotifications.map(notification => (
              <div key={notification.id} className={`border rounded-lg p-4 ${notification.color}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold">{notification.name}</h3>
                  <button
                    onClick={() => sendTestEmail(notification)}
                    disabled={loading === notification.id}
                    className="bg-white/80 hover:bg-white text-gray-700 px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {loading === notification.id ? '⏳' : '📧'}
                  </button>
                </div>
                <div className="text-sm space-y-2">
                  <p><strong>Título:</strong> {notification.title}</p>
                  <p><strong>Mensaje:</strong> {notification.body.substring(0, 100)}...</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="bg-white/60 px-2 py-1 rounded text-xs">
                      {notification.primaryAction.label}
                    </span>
                    <span className="bg-white/60 px-2 py-1 rounded text-xs">
                      {notification.secondaryAction.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">📋 Resultados de Tests</h3>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div key={index} className={`p-4 rounded-lg ${
                    result.status === 'success' 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                            {result.status === 'success' ? '✅' : '❌'}
                          </span>
                          <span className="font-medium">{result.name}</span>
                        </div>
                        {result.status === 'success' ? (
                          <div className="text-sm text-green-700 mt-1">
                            Email ID: {result.emailId}
                          </div>
                        ) : (
                          <div className="text-sm text-red-700 mt-1">
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">📋 Instrucciones para Testing</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Haz clic en "Enviar Todos los Tests" para probar todos los tipos de email</li>
              <li>O usa los botones individuales para probar tipos específicos</li>
              <li>Ve al Admin Panel (/admin/notificaciones/email) para ver los analytics</li>
              <li>Revisa tu email ({user?.email}) para ver los emails recibidos</li>
              <li>Verifica que los emails se muestran correctamente en diferentes clientes</li>
            </ol>
          </div>

        </div>
      </div>
    </div>
  )
}