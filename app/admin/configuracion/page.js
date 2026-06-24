// app/admin/configuracion/page.js - Dashboard de configuración y emails
'use client'
import { useState, useEffect } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import Link from 'next/link'

export default function ConfiguracionPage() {
  const [emailQueue, setEmailQueue] = useState([])
  const [emailLogs, setEmailLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [previewUser, setPreviewUser] = useState(null)
  const [campaignResults, setCampaignResults] = useState(null)

  useEffect(() => {
    loadEmailData()
  }, [])

  async function loadEmailData() {
    setLoading(true)
    try {
      // 1. Detectar usuarios que necesitan emails - VIA API
      const queueResponse = await fetch('/api/emails/queue')
      const queueData = await queueResponse.json()

      const queue = queueData.success ? queueData.queue : []
      setEmailQueue(queue)

      // 2. Cargar historial de emails (últimos 50) — endpoint admin Drizzle
      const logsRes = await adminFetch('/api/v2/admin/email-logs')
      if (!logsRes.ok) throw new Error(`email-logs ${logsRes.status}`)
      setEmailLogs((await logsRes.json()).logs || [])

    } catch (err) {
      console.error('Error cargando datos de emails:', err)
    } finally {
      setLoading(false)
    }
  }

  async function runEmailCampaign() {
  setCampaignLoading(true)
  try {
    console.log('🚀 Ejecutando campaña de emails via API...')
    
    const response = await fetch('/api/emails/campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const results = await response.json()
    setCampaignResults(results)
    
    // Recargar datos
    await loadEmailData()
    
  } catch (err) {
    console.error('Error en campaña:', err)
    setCampaignResults({
      success: false,
      error: err.message,
      total: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    })
  } finally {
    setCampaignLoading(false)
  }
}

  function getEmailTypeInfo(emailType) {
    const types = {
      reactivation_urgent: { name: 'Reactivación Urgente', color: 'bg-red-100 text-red-800', icon: '🚨' },
      reactivation_gentle: { name: 'Reactivación Suave', color: 'bg-orange-100 text-orange-800', icon: '📚' },
      congratulations: { name: 'Felicitación', color: 'bg-green-100 text-green-800', icon: '🏆' },
      encouragement: { name: 'Ánimo', color: 'bg-blue-100 text-blue-800', icon: '💪' }
    }
    return types[emailType] || { name: emailType, color: 'bg-gray-100 text-gray-800', icon: '📧' }
  }

  function formatTimeAgo(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Hace menos de 1 hora'
    if (diffInHours < 24) return `Hace ${diffInHours} horas`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Hace ${diffInDays} días`
    
    return date.toLocaleDateString('es-ES')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📧 Cargando configuración de emails...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ⚙️ Configuración del Sistema
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de emails automáticos y configuración general
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={loadEmailData}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            🔄 Actualizar
          </button>
          <Link 
            href="/admin" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Resultados de campaña */}
      {campaignResults && (
        <div className={`p-4 rounded-lg border ${
          campaignResults.error 
            ? 'bg-red-50 border-red-200 dark:bg-red-900/20' 
            : 'bg-green-50 border-green-200 dark:bg-green-900/20'
        }`}>
          <h3 className={`font-bold mb-2 ${
            campaignResults.error ? 'text-red-800' : 'text-green-800'
          }`}>
            {campaignResults.error ? '❌ Error en Campaña' : '✅ Campaña Completada'}
          </h3>
          {campaignResults.error ? (
            <p className="text-red-600">{campaignResults.error}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Total:</span> {campaignResults.total}
              </div>
              <div>
                <span className="font-medium text-green-600">Enviados:</span> {campaignResults.successful}
              </div>
              <div>
                <span className="font-medium text-red-600">Fallidos:</span> {campaignResults.failed}
              </div>
            </div>
          )}
          <button 
            onClick={() => setCampaignResults(null)}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            ✕ Cerrar
          </button>
        </div>
      )}

      {/* Panel de campaña de emails */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            📧 Sistema de Emails Automáticos
          </h2>
          <button
            onClick={runEmailCampaign}
            disabled={campaignLoading || emailQueue.length === 0}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {campaignLoading ? (
              <span className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Enviando...</span>
              </span>
            ) : (
              `🚀 Enviar ${emailQueue.length} Emails`
            )}
          </button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{emailQueue.length}</div>
            <div className="text-sm text-gray-600">Emails Pendientes</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {emailLogs.filter(log => log.status === 'sent').length}
            </div>
            <div className="text-sm text-gray-600">Enviados (Total)</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {emailLogs.filter(log => log.opened_at).length}
            </div>
            <div className="text-sm text-gray-600">Abiertos</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {emailLogs.filter(log => log.clicked_at).length}
            </div>
            <div className="text-sm text-gray-600">Clicks</div>
          </div>
        </div>

        {/* Cola de emails pendientes */}
        {emailQueue.length > 0 ? (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              📬 Emails Listos para Enviar ({emailQueue.length})
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {emailQueue.slice(0, 10).map((item, index) => {
                const typeInfo = getEmailTypeInfo(item.emailType)
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {item.user.full_name?.charAt(0) || item.user.email?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-500">{item.user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.icon} {typeInfo.name}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-600">
                          Prioridad: {item.priority}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.user.activity?.daysSinceLastSession 
                            ? `${item.user.activity.daysSinceLastSession} días inactivo` 
                            : 'Usuario activo'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {emailQueue.length > 10 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                ... y {emailQueue.length - 10} emails más
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 mb-6">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay emails pendientes
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Todos los usuarios están al día. ¡Excelente trabajo!
            </p>
          </div>
        )}
      </div>

      {/* Historial de emails */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📋 Historial de Emails
        </h2>
        
        {emailLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enviado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {emailLogs.slice(0, 20).map((log, index) => {
                  const typeInfo = getEmailTypeInfo(log.email_type)
                  return (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {log.user_profiles.full_name?.charAt(0) || log.user_profiles.email?.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.user_profiles.full_name || 'Sin nombre'}
                            </div>
                            <div className="text-sm text-gray-500">{log.user_profiles.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {log.subject}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimeAgo(log.sent_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.clicked_at ? 'bg-green-100 text-green-800' :
                            log.opened_at ? 'bg-blue-100 text-blue-800' :
                            log.status === 'sent' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.clicked_at ? '✅ Clicked' :
                             log.opened_at ? '👁️ Abierto' :
                             log.status === 'sent' ? '📤 Enviado' :
                             '⏳ Pendiente'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500">No hay emails en el historial</p>
          </div>
        )}
      </div>

      {/* Configuración adicional */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          🛠️ Configuración Adicional
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Configuración de frecuencia */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">📅 Frecuencia de Emails</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600" defaultChecked />
                <span className="ml-2 text-sm">Emails de reactivación automáticos</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600" defaultChecked />
                <span className="ml-2 text-sm">Felicitaciones a Power Users</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
                <span className="ml-2 text-sm">Recordatorios semanales</span>
              </label>
            </div>
          </div>

          {/* Configuración de umbrales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">⚙️ Umbrales de Activación</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Reactivación suave:</span>
                <span className="text-sm font-medium">7 días</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Reactivación urgente:</span>
                <span className="text-sm font-medium">14 días</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Power User mínimo:</span>
                <span className="text-sm font-medium">80% completion</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
