// app/admin/debug/page.js - Panel de Debug dentro del Admin
'use client'
import { useState, useEffect } from 'react'
import { useIntelligentNotifications } from '../../../hooks/useIntelligentNotifications'

export default function AdminDebugPage() {
  const {
    notifications,
    unreadCount,
    loading,
    categorizedNotifications,
    injectTestNotification,
    clearAllNotifications,
    markAsRead,
    dismissNotification,
    notificationTypes
  } = useIntelligentNotifications()

  const [logs, setLogs] = useState([])
  const [selectedNotification, setSelectedNotification] = useState(null)

  // Agregar log
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [{
      id: Date.now(),
      timestamp,
      message,
      type
    }, ...prev.slice(0, 49)]) // Mantener solo 50 logs
  }

  // Notificaciones de prueba
  const testNotifications = {
    constructive_progress: {
      id: 'test-constructive-progress',
      type: 'constructive_progress',
      title: '🌱 Construyendo Base Sólida',
      message: 'Tu progreso es sólido y constante. Has completado el 65% de tus objetivos de estudio esta semana.',
      timestamp: new Date().toISOString(),
      isRead: false,
      progress: 65,
      daily_questions: 12
    },
    
    problematic_articles: {
      id: 'test-problematic-articles',
      type: 'problematic_articles',
      title: '📉 Artículos Problemáticos Detectados',
      message: 'Hemos detectado 3 artículos de la Ley 39/2015 donde tienes más errores: Art. 13, 21, 22.',
      timestamp: new Date().toISOString(),
      isRead: false,
      law_short_name: 'Ley 39/2015',
      law_full_name: 'Ley 39/2015 del Procedimiento Administrativo Común',
      articlesCount: 3,
      articlesList: [
        { article_number: 13, error_rate: 75 },
        { article_number: 21, error_rate: 68 },
        { article_number: 22, error_rate: 72 }
      ]
    },
    
    level_regression: {
      id: 'test-level-regression',
      type: 'level_regression',
      title: '📉 Regresión Detectada',
      message: 'Tu rendimiento en Constitución Española ha bajado un 15% esta semana.',
      timestamp: new Date().toISOString(),
      isRead: false,
      law_short_name: 'CE',
      law_full_name: 'Constitución Española',
      regression_percentage: 15
    },
    
    achievement: {
      id: 'test-achievement',
      type: 'achievement',
      title: '🏆 ¡Logro Desbloqueado!',
      message: '¡Felicidades! Has conseguido una racha de 7 días consecutivos.',
      timestamp: new Date().toISOString(),
      isRead: false,
      achievement_type: 'streak_7_days',
      streak_days: 7
    },
    
    dispute_update: {
      id: 'test-dispute-update',
      type: 'dispute_update',
      title: '✅ Impugnación Resuelta',
      message: 'Tu impugnación sobre la pregunta #1234 ha sido aceptada.',
      timestamp: new Date().toISOString(),
      isRead: false,
      disputeId: 'test-dispute-123',
      question_id: 'test-question-456'
    },
    
    feedback_response: {
      id: 'test-feedback-response',
      type: 'feedback_response',
      title: '💬 Respuesta del Soporte',
      message: 'Hemos respondido a tu consulta sobre el tema "Procedimiento Administrativo".',
      timestamp: new Date().toISOString(),
      isRead: false,
      context_data: {
        conversation_id: 'test-conversation-789'
      }
    }
  }

  const injectNotification = (type) => {
    if (!injectTestNotification) {
      addLog('❌ injectTestNotification no está disponible', 'error')
      return
    }

    const notification = testNotifications[type]
    if (!notification) {
      addLog(`❌ Notificación tipo ${type} no encontrada`, 'error')
      return
    }

    // Crear una instancia única
    const uniqueNotification = {
      ...notification,
      id: `${notification.id}-${Date.now()}`,
      timestamp: new Date().toISOString()
    }

    try {
      injectTestNotification(uniqueNotification)
      addLog(`✅ Notificación ${type} inyectada: ${uniqueNotification.id}`, 'success')
    } catch (error) {
      addLog(`❌ Error inyectando ${type}: ${error.message}`, 'error')
    }
  }

  const clearAll = () => {
    if (!clearAllNotifications) {
      addLog('❌ clearAllNotifications no está disponible', 'error')
      return
    }

    try {
      clearAllNotifications()
      addLog('🧹 Todas las notificaciones de testing han sido limpiadas', 'success')
    } catch (error) {
      addLog(`❌ Error limpiando: ${error.message}`, 'error')
    }
  }

  const testMarkAsRead = (notificationId) => {
    try {
      markAsRead(notificationId)
      addLog(`👁️ Notificación ${notificationId} marcada como leída`, 'info')
    } catch (error) {
      addLog(`❌ Error marcando como leída: ${error.message}`, 'error')
    }
  }

  const testDismiss = (notificationId) => {
    try {
      dismissNotification(notificationId)
      addLog(`🗑️ Notificación ${notificationId} descartada`, 'info')
    } catch (error) {
      addLog(`❌ Error descartando: ${error.message}`, 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🐛 Panel de Debug
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Herramientas de debugging para el sistema de notificaciones
        </p>
        <div className="mt-4 flex items-center space-x-4 text-sm">
          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
            Admin Debug
          </span>
          <span className="text-gray-500">
            Total: {notifications?.length || 0} | No leídas: {unreadCount || 0}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Control */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🎮 Panel de Control
            </h2>
            
            {/* Estado del Sistema */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📊 Estado del Sistema
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-mono">{notifications?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>No leídas:</span>
                  <span className="font-mono text-red-600">{unreadCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cargando:</span>
                  <span className="font-mono">{loading ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Inyectar Notificaciones */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                🧪 Inyectar Notificaciones
              </h3>
              <div className="space-y-2">
                {Object.keys(testNotifications).map((type) => {
                  const config = notificationTypes?.[type] || {}
                  return (
                    <button
                      key={type}
                      onClick={() => injectNotification(type)}
                      className="w-full text-left px-3 py-2 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="font-mono">{config.icon || '📄'}</span> {testNotifications[type].title}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Acciones */}
            <div className="space-y-2">
              <button
                onClick={clearAll}
                className="w-full px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              >
                🧹 Limpiar Todo
              </button>
            </div>
          </div>
        </div>

        {/* Área Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lista de Notificaciones */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📋 Notificaciones Actuales
            </h2>
            
            {notifications && notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      notification.isRead 
                        ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' 
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    } ${selectedNotification?.id === notification.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedNotification(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{notificationTypes?.[notification.type]?.icon || '📄'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </span>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Tipo: {notification.type}</span>
                          <span>ID: {notification.id.slice(-8)}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              testMarkAsRead(notification.id)
                            }}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800"
                          >
                            👁️ Leer
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            testDismiss(notification.id)
                          }}
                          className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800"
                        >
                          🗑️ Descartar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay notificaciones actualmente
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📝 Logs de Actividad
            </h2>
            
            <div className="bg-gray-900 rounded-lg p-4 max-h-60 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="text-sm font-mono mb-1">
                    <span className="text-gray-400">{log.timestamp}</span>
                    <span className={`ml-2 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">No hay logs aún...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detalles de Notificación Seleccionada */}
      {selectedNotification && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🔍 Detalles de Notificación
          </h2>
          <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-sm overflow-x-auto">
            {JSON.stringify(selectedNotification, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}