// components/NotificationTester.js - PANEL DE TESTING PARA NOTIFICACIONES (SOLO DESARROLLO)
'use client'
import { useState } from 'react'
import { useIntelligentNotifications } from '../hooks/useIntelligentNotifications'

export default function NotificationTester() {
  // Los hooks deben llamarse SIEMPRE antes de cualquier return (rules-of-hooks).
  const { injectTestNotification, clearAllNotifications } = useIntelligentNotifications()
  const [isExpanded, setIsExpanded] = useState(false)

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // 📦 NOTIFICACIONES DE PRUEBA
  const testNotifications = {
    constructive_progress: {
      id: 'test-constructive-progress',
      type: 'constructive_progress',
      title: '🌱 Construyendo Base Sólida',
      message: 'Tu progreso es sólido y constante. Has completado el 65% de tus objetivos de estudio esta semana. ¡Sigue construyendo tu futuro!',
      timestamp: new Date().toISOString(),
      isRead: false,
      progress: 65,
      daily_questions: 12,
      source: 'test'
    },
    
    problematic_articles: {
      id: 'test-problematic-articles',
      type: 'problematic_articles',
      title: '📉 Artículos Problemáticos Detectados',
      message: 'Hemos detectado 3 artículos de la Ley 39/2015 donde tienes más errores: Art. 14, 25, 47. Te recomendamos hacer un test intensivo.',
      timestamp: new Date().toISOString(),
      isRead: false,
      law_short_name: 'LPAC',
      law_full_name: 'Ley 39/2015 del Procedimiento Administrativo Común',
      articlesCount: 3,
      articlesList: [
        { article_number: 14, error_rate: 75 },
        { article_number: 25, error_rate: 68 },
        { article_number: 47, error_rate: 72 }
      ],
      campaign: 'test_problematic_articles'
    },
    
    level_regression: {
      id: 'test-level-regression',
      type: 'level_regression',
      title: '📉 Regresión Detectada',
      message: 'Tu rendimiento en Constitución Española ha bajado un 15% esta semana. Te recomendamos un test de refuerzo.',
      timestamp: new Date().toISOString(),
      isRead: false,
      law_short_name: 'CE',
      law_full_name: 'Constitución Española',
      regression_percentage: 15,
      campaign: 'test_regression'
    },
    
    achievement: {
      id: 'test-achievement',
      type: 'achievement',
      title: '🏆 ¡Logro Desbloqueado!',
      message: '¡Felicidades! Has conseguido una racha de 7 días consecutivos. ¡Estás en el camino correcto hacia el éxito!',
      timestamp: new Date().toISOString(),
      isRead: false,
      achievement_type: 'streak_7_days',
      streak_days: 7,
      campaign: 'test_achievement'
    },
    
    improvement: {
      id: 'test-improvement',
      type: 'improvement',
      title: '📈 ¡Excelente Mejora!',
      message: 'Tu precisión en LPAC ha mejorado un 20% en los últimos 5 tests. ¡Sigue así!',
      timestamp: new Date().toISOString(),
      isRead: false,
      law_short_name: 'LPAC',
      improvement_percentage: 20,
      campaign: 'test_improvement'
    },
    
    dispute_update: {
      id: 'test-dispute-update',
      type: 'dispute_update',
      title: '✅ Impugnación Resuelta',
      message: 'Tu impugnación sobre la pregunta #1234 ha sido aceptada. La pregunta ha sido corregida.',
      timestamp: new Date().toISOString(),
      isRead: false,
      disputeId: 'test-dispute-123',
      question_id: 'test-question-456',
      resolution: 'accepted',
      campaign: 'test_dispute'
    },
    
    feedback_response: {
      id: 'test-feedback-response',
      type: 'feedback_response',
      title: '💬 Respuesta del Soporte',
      message: 'Hemos respondido a tu consulta sobre el tema "Procedimiento Administrativo". ¡Revisa nuestra respuesta!',
      timestamp: new Date().toISOString(),
      isRead: false,
      context_data: {
        conversation_id: 'test-conversation-789'
      },
      campaign: 'test_feedback'
    }
  }

  const injectNotification = (type) => {
    const notification = testNotifications[type]
    if (notification && injectTestNotification) {
      // Crear una nueva instancia con timestamp único
      const uniqueNotification = {
        ...notification,
        id: `${notification.id}-${Date.now()}`,
        timestamp: new Date().toISOString()
      }
      injectTestNotification(uniqueNotification)
      console.log('🧪 Test notification injected:', uniqueNotification)
    } else {
      console.warn('❌ No se pudo inyectar la notificación:', type)
    }
  }

  const clearAll = () => {
    if (clearAllNotifications) {
      clearAllNotifications()
      console.log('🧹 All test notifications cleared')
    }
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg shadow-lg font-mono text-sm"
          title="Abrir panel de testing de notificaciones"
        >
          🧪 TEST
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border-2 border-purple-500 rounded-lg shadow-xl p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-purple-600 dark:text-purple-400 text-sm">
          🧪 Notification Tester
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* CRÍTICAS */}
        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2">🔴 Críticas</div>
        <button
          onClick={() => injectNotification('level_regression')}
          className="w-full text-left px-2 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-800"
        >
          📉 Regresión Detectada
        </button>
        
        {/* IMPORTANTES */}
        <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-2">🟠 Importantes</div>
        <button
          onClick={() => injectNotification('problematic_articles')}
          className="w-full text-left px-2 py-1 text-xs bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 rounded border border-orange-200 dark:border-orange-800"
        >
          📉 Artículos Problemáticos
        </button>
        
        {/* RECOMENDACIONES */}
        <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mt-2">🟡 Recomendaciones</div>
        <button
          onClick={() => injectNotification('achievement')}
          className="w-full text-left px-2 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 rounded border border-yellow-200 dark:border-yellow-800"
        >
          🏆 Logro Desbloqueado
        </button>
        <button
          onClick={() => injectNotification('improvement')}
          className="w-full text-left px-2 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 rounded border border-yellow-200 dark:border-yellow-800"
        >
          📈 Excelente Mejora
        </button>
        
        {/* INFORMATIVAS */}
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2">🔵 Informativas</div>
        <button
          onClick={() => injectNotification('dispute_update')}
          className="w-full text-left px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-800"
        >
          ✅ Impugnación Resuelta
        </button>
        <button
          onClick={() => injectNotification('feedback_response')}
          className="w-full text-left px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-800"
        >
          💬 Respuesta del Soporte
        </button>
        
        {/* MOTIVACIONALES */}
        <div className="text-xs font-semibold text-green-600 dark:text-green-400 mt-2">🟢 Motivacionales</div>
        <button
          onClick={() => injectNotification('constructive_progress')}
          className="w-full text-left px-2 py-1 text-xs bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded border border-green-200 dark:border-green-800"
        >
          🌱 Construyendo Base Sólida
        </button>
        
        {/* ACCIONES */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-3">
          <button
            onClick={clearAll}
            className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
          >
            🧹 Limpiar Todas
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        Solo visible en desarrollo
      </div>
    </div>
  )
}