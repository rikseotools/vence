// app/admin/usuarios/[id]/emails/page.js - Historial de emails de un usuario específico
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function UserEmailHistoryPage() {
  const { supabase } = useAuth()
  const params = useParams()
  const userId = params.id
  
  const [user, setUser] = useState(null)
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailPreferences, setEmailPreferences] = useState(null)
  
  // Filtros
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('recent')

  useEffect(() => {
    if (userId && supabase) {
      loadUserData()
      loadEmailHistory()
      loadEmailPreferences()
    }
  }, [userId, supabase])

  async function loadUserData() {
    try {
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single()

      if (userError) throw userError
      setUser(userData)
    } catch (err) {
      console.error('Error cargando datos del usuario:', err)
    }
  }

  async function loadEmailHistory() {
    try {
      setLoading(true)
      console.log('📧 Cargando historial de emails para usuario:', userId)

      const { data: emailHistory, error: emailError } = await supabase
        .from('email_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (emailError) throw emailError

      console.log('📧 Emails cargados:', emailHistory.length)
      setEmails(emailHistory || [])

    } catch (err) {
      console.error('❌ Error cargando historial de emails:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadEmailPreferences() {
    try {
      const { data: preferences, error: prefError } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (prefError && prefError.code !== 'PGRST116') {
        console.error('Error cargando preferencias:', prefError)
      } else {
        setEmailPreferences(preferences)
      }
    } catch (err) {
      console.error('Error cargando preferencias de email:', err)
    }
  }

  // Generar HTML del email para preview
  function generateEmailHTML(email) {
    const emailType = email.email_type
    const templateId = email.template_id
    const subject = email.subject || 'Sin asunto'
    const preview = email.email_content_preview || 'Sin contenido'
    const userName = user?.full_name || 'Estudiante'

    // Generar HTML basado en el tipo de email
    switch (emailType) {
      case 'medal':
        return generateMedalEmailHTML(email, userName, subject, preview)
      case 'motivation':
        return generateMotivationEmailHTML(email, userName, subject, preview, templateId)
      default:
        return generateGenericEmailHTML(email, userName, subject, preview)
    }
  }

  function generateMedalEmailHTML(email, userName, subject, preview) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333; text-align: center; padding: 40px 20px;">
              <div style="font-size: 64px; margin-bottom: 20px;">🏆</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">¡Nueva Medalla Desbloqueada!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.8; font-size: 16px;">Vence - Auxiliar Administrativo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; margin-bottom: 20px;">¡Hola ${userName}! 🎉</p>
              
              <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); border-radius: 15px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="font-size: 48px; margin-bottom: 15px;">🥇</div>
                <h2 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">[Título de Medalla]</h2>
                <p style="margin: 0; color: #666; font-size: 14px;">[Descripción de logro]</p>
              </div>
              
              <p style="font-size: 16px; margin-bottom: 25px; text-align: center;">${preview}</p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                   style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  🎯 Ver Mis Medallas
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                <a href="https://www.vence.es/perfil" style="color: #667eea; text-decoration: none;">Gestionar preferencias</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  function generateMotivationEmailHTML(email, userName, subject, preview, templateId) {
    const getMotivationIcon = () => {
      switch (templateId) {
        case 'comeback': return '💪'
        case 'streak_risk': return '🔥'
        case 'achievement': return '🎉'
        default: return '📚'
      }
    }

    const getMotivationTitle = () => {
      switch (templateId) {
        case 'comeback': return '¡Vuelve a la preparación!'
        case 'streak_risk': return '¡Tu racha está en peligro!'
        case 'achievement': return '¡Vas muy bien!'
        default: return '¡Continúa estudiando!'
      }
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${getMotivationIcon()} ${getMotivationTitle()}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Vence - Auxiliar Administrativo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${userName}! 👋</p>
              
              <p style="font-size: 16px; margin-bottom: 25px;">${preview}</p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                   style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  🎯 Hacer Test Ahora
                </a>
              </div>
              
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  💡 <strong>Recuerda:</strong> La constancia es clave para aprobar las oposiciones. ¡Cada minuto de estudio cuenta!
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                <a href="https://www.vence.es/perfil" style="color: #667eea; text-decoration: none;">Gestionar preferencias de notificaciones</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  function generateGenericEmailHTML(email, userName, subject, preview) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">📧 ${subject}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Vence - Auxiliar Administrativo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${userName}! 👋</p>
              <p style="font-size: 16px; margin-bottom: 25px;">${preview}</p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                © 2025 Vence. Te ayudamos a conseguir tu plaza.
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  function getEmailTypeIcon(type) {
    switch (type) {
      case 'medal': return '🏆'
      case 'motivation': return '📧'
      case 'reactivation': return '🔄'
      default: return '📮'
    }
  }

  function getEmailTypeColor(type) {
    switch (type) {
      case 'medal': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'motivation': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'reactivation': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  function getEventTypeIcon(eventType) {
    switch (eventType) {
      case 'sent': return '📤'
      case 'delivered': return '✅'
      case 'opened': return '👁️'
      case 'clicked': return '🖱️'
      case 'bounced': return '❌'
      case 'complained': return '⚠️'
      default: return '📮'
    }
  }

  function getEventTypeColor(eventType) {
    switch (eventType) {
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'delivered': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'opened': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'clicked': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'bounced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'complained': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  // Filtrar y ordenar emails
  const filteredEmails = emails
    .filter(email => {
      if (filterType !== 'all' && email.email_type !== filterType) return false
      if (filterStatus !== 'all' && email.event_type !== filterStatus) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at)
        case 'type':
          return a.email_type.localeCompare(b.email_type)
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📧 Cargando historial de emails...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error cargando emails</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header con información del usuario */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📧 Historial de Emails
          </h1>
          {user && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Usuario: <span className="font-semibold">{user.full_name || user.email}</span>
            </p>
          )}
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={loadEmailHistory}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 Actualizar
          </button>
          <Link 
            href={`/admin/usuarios/${userId}`}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            ← Ver Usuario
          </Link>
        </div>
      </div>

      {/* Preferencias de email */}
      {emailPreferences && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3">⚙️ Preferencias de Email</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className={`px-3 py-1 rounded-full ${
              emailPreferences.unsubscribed_all 
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {emailPreferences.unsubscribed_all ? '❌ Todos desactivados' : '✅ Emails activos'}
            </div>
            <div className={`px-3 py-1 rounded-full ${
              emailPreferences.email_reactivacion === false
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {emailPreferences.email_reactivacion === false ? '❌ Reactivación OFF' : '✅ Reactivación ON'}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Todos los tipos</option>
            <option value="medal">🏆 Medallas</option>
            <option value="motivation">📧 Motivacionales</option>
            <option value="reactivation">🔄 Reactivación</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Todos los estados</option>
            <option value="sent">📤 Enviados</option>
            <option value="delivered">✅ Entregados</option>
            <option value="opened">👁️ Abiertos</option>
            <option value="clicked">🖱️ Clickeados</option>
            <option value="bounced">❌ Rebotados</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="recent">📅 Más recientes</option>
            <option value="oldest">🕒 Más antiguos</option>
            <option value="type">📂 Por tipo</option>
          </select>
        </div>
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Mostrando {filteredEmails.length} de {emails.length} emails
        </div>
      </div>

      {/* Lista de emails */}
      <div className="space-y-4">
        {filteredEmails.map((email) => (
          <div key={email.id} className="bg-white dark:bg-gray-800 rounded-lg border p-6 hover:shadow-lg transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Información principal */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEmailTypeColor(email.email_type)}`}>
                    {getEmailTypeIcon(email.email_type)} {email.email_type}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(email.event_type)}`}>
                    {getEventTypeIcon(email.event_type)} {email.event_type}
                  </span>
                  {email.template_id && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full dark:bg-gray-700 dark:text-gray-300">
                      {email.template_id}
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {email.subject || 'Sin asunto'}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {email.email_content_preview || 'Sin vista previa disponible'}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>📅 {new Date(email.created_at).toLocaleString()}</span>
                  <span>📧 {email.email_address}</span>
                  {email.resend_id && (
                    <span>🆔 {email.resend_id}</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedEmail(email)
                    setShowEmailModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  👁️ Ver Email
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mensaje si no hay emails */}
      {filteredEmails.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No se encontraron emails
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {emails.length === 0 
              ? 'Este usuario no ha recibido emails aún'
              : 'Prueba ajustando los filtros'
            }
          </p>
        </div>
      )}

      {/* Modal para previsualizar email */}
      {showEmailModal && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📧 Vista previa del email
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedEmail.subject} • {new Date(selectedEmail.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {/* Metadata del email */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Tipo:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${getEmailTypeColor(selectedEmail.email_type)}`}>
                    {getEmailTypeIcon(selectedEmail.email_type)} {selectedEmail.email_type}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Estado:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${getEventTypeColor(selectedEmail.event_type)}`}>
                    {getEventTypeIcon(selectedEmail.event_type)} {selectedEmail.event_type}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Template:</span>
                  <span className="ml-2 text-gray-600">{selectedEmail.template_id || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium">Resend ID:</span>
                  <span className="ml-2 text-gray-600 font-mono text-xs">{selectedEmail.resend_id || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            {/* Contenido del email */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <iframe
                srcDoc={generateEmailHTML(selectedEmail)}
                className="w-full h-[500px] border rounded-lg"
                title="Email Preview"
              />
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}