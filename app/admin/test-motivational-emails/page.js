// app/admin/test-motivational-emails/page.js - PÁGINA DE PRUEBAS MOTIVACIONALES
'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function TestMotivationalEmailsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState('')
  const [results, setResults] = useState([])

  const testEmails = [
    {
      id: 'achievement',
      name: '🏆 Logro',
      data: {
        userEmail: 'ilovetestpro@gmail.com',
        userName: 'Manuel (Test)',
        messageType: 'achievement',
        title: '🏆 ¡Nuevo Logro Desbloqueado!',
        body: '¡Felicidades! Has completado 50 preguntas correctas seguidas. Tu dedicación y esfuerzo están dando resultados increíbles.',
        primaryAction: { label: '🚀 Siguiente Desafío (8 min)', type: 'next_challenge' },
        secondaryAction: { label: '📊 Ver Logros', type: 'view_achievements' },
        userId: user?.id
      }
    },
    {
      id: 'study_streak',
      name: '🔥 Racha',
      data: {
        userEmail: 'ilovetestpro@gmail.com',
        userName: 'Manuel (Test)',
        messageType: 'study_streak',
        title: '🔥 ¡Racha de 7 Días!',
        body: '¡Impresionante! Llevas 7 días consecutivos estudiando. La constancia es clave para el éxito en las oposiciones.',
        primaryAction: { label: '🎯 Mantener Racha (5 min)', type: 'maintain_streak' },
        secondaryAction: { label: '📈 Ver Estadísticas', type: 'view_streak_stats' },
        userId: user?.id
      }
    },
    {
      id: 'improvement',
      name: '📈 Mejora',
      data: {
        userEmail: 'ilovetestpro@gmail.com',
        userName: 'Manuel (Test)',
        messageType: 'improvement',
        title: '📈 Mejora Significativa Detectada',
        body: 'Tu precisión ha mejorado un 15% en la última semana. ¡Vas por el buen camino hacia tu objetivo!',
        primaryAction: { label: '🎯 Consolidar Mejora (10 min)', type: 'consolidate_improvement' },
        secondaryAction: { label: '📊 Ver Progreso', type: 'view_progress' },
        userId: user?.id
      }
    },
    {
      id: 'practice_reminder',
      name: '⏰ Recordatorio',
      data: {
        userEmail: 'ilovetestpro@gmail.com',
        userName: 'Manuel (Test)',
        messageType: 'practice_reminder',
        title: '⏰ Momento Perfecto para Practicar',
        body: 'Han pasado 2 días desde tu última sesión. Un test rápido te ayudará a mantener el ritmo.',
        primaryAction: { label: '🚀 Test Rápido (5 min)', type: 'quick_test' },
        secondaryAction: { label: '📚 Ver Temario', type: 'view_theory' },
        userId: user?.id
      }
    },
    {
      id: 'weakness',
      name: '⚠️ Área débil',
      data: {
        userEmail: 'ilovetestpro@gmail.com',
        userName: 'Manuel (Test)',
        messageType: 'weakness',
        title: '⚠️ Área de Mejora Identificada',
        body: 'Has tenido dificultades con el Tema 3. Un repaso específico te ayudará a fortalecer este área.',
        primaryAction: { label: '📚 Repaso Dirigido (15 min)', type: 'directed_review' },
        secondaryAction: { label: '🔍 Ver Detalles', type: 'view_weak_areas' },
        userId: user?.id
      }
    }
  ]

  const sendTestEmail = async (testEmail) => {
    setLoading(testEmail.id)
    try {
      const response = await fetch('/api/send-motivational-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testEmail.data)
      })

      const result = await response.json()
      
      if (response.ok) {
        setResults(prev => [...prev, {
          type: testEmail.name,
          status: 'success',
          message: `✅ Email enviado: ${result.emailId}`,
          time: new Date().toLocaleTimeString()
        }])
      } else {
        setResults(prev => [...prev, {
          type: testEmail.name,
          status: 'error',
          message: `❌ Error: ${result.error}`,
          time: new Date().toLocaleTimeString()
        }])
      }
    } catch (error) {
      setResults(prev => [...prev, {
        type: testEmail.name,
        status: 'error',
        message: `❌ Error: ${error.message}`,
        time: new Date().toLocaleTimeString()
      }])
    }
    setLoading('')
  }

  const sendAllEmails = async () => {
    setLoading('all')
    setResults([])
    
    for (const testEmail of testEmails) {
      await sendTestEmail(testEmail)
      // Esperar 1 segundo entre emails
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setLoading('')
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 Test de Emails Motivacionales
          </h1>
          <p className="text-gray-600">
            Prueba el sistema de fallback de emails motivacionales
          </p>
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-blue-800">
              <strong>Usuario:</strong> {user?.email || 'No logueado'}<br/>
              <strong>Destino:</strong> ilovetestpro@gmail.com<br/>
              <strong>Analytics:</strong> <a href="/admin/notificaciones/email" className="underline">Ver en panel admin</a>
            </p>
          </div>
        </div>

        {/* Botones de prueba */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {testEmails.map((testEmail) => (
            <button
              key={testEmail.id}
              onClick={() => sendTestEmail(testEmail)}
              disabled={loading === testEmail.id || loading === 'all'}
              className="p-4 bg-white rounded-lg shadow border hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-lg font-semibold mb-2">{testEmail.name}</div>
              <div className="text-sm text-gray-600 mb-3">{testEmail.data.title}</div>
              <div className="text-xs text-gray-500">
                {loading === testEmail.id ? '⏳ Enviando...' : '📧 Enviar Test'}
              </div>
            </button>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={sendAllEmails}
            disabled={loading !== ''}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading === 'all' ? '⏳ Enviando Todos...' : '🚀 Enviar Todos'}
          </button>
          
          <button
            onClick={clearResults}
            className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            🗑️ Limpiar Resultados
          </button>
          
          <a
            href="/admin/notificaciones/email"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            📊 Ver Analytics
          </a>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📋 Resultados</h3>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  result.status === 'success' 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{result.type}</span>
                      <div className="text-sm text-gray-600">{result.message}</div>
                    </div>
                    <span className="text-xs text-gray-500">{result.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📖 Instrucciones</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Haz clic en cualquier botón para enviar un email de prueba</li>
            <li>Revisa tu bandeja de entrada (y spam) en <strong>ilovetestpro@gmail.com</strong></li>
            <li>Ve al <a href="/admin/notificaciones/email" className="text-blue-600 underline">panel de analytics</a> para ver los eventos</li>
            <li>Los emails aparecerán como tipo <code className="bg-gray-100 px-1 rounded">motivational</code></li>
            <li>Cada email tiene botones de acción funcionales</li>
          </ol>
        </div>

      </div>
    </div>
  )
}