// app/admin/newsletters/page.tsx - Panel de newsletters
'use client'
import { useState, useEffect, ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================
// TIPOS
// ============================================

interface AudienceOption {
  value: string
  label: string
  description: string
  group: 'general' | 'oposicion'
}

interface OposicionStat {
  key: string
  name: string
  count: number
}

interface AudienceStats {
  all: number
  active: number
  inactive: number
  premium: number
  free: number
  byOposicion?: OposicionStat[]
  [key: string]: number | OposicionStat[] | undefined
}

interface User {
  id: string
  email: string
  full_name: string | null
  created_at?: string
  user_id?: string
  userId?: string
  fullName?: string | null
  activityLevel?: 'very_active' | 'active' | 'dormant' | string
  avgScore?: number
  accountAgeDays?: number | null
  lastTestDate?: string | null
  timestamp?: string
}

interface Template {
  id: string
  name: string
  subject: string
  content: string
}

interface SendResult {
  success: boolean
  message?: string
  error?: string
  details?: string
  total?: number
  sent?: number
  failed?: number
  audiences?: Array<{ audienceName: string }>
  errors?: Array<{ email: string; error: string }>
  retryAttempted?: boolean
  lastRetryResult?: { sent?: number; failed?: number }
}

interface UserPagination {
  total: number
  totalPages: number
  page: number
  hasMore: boolean
}

interface SendingProgress {
  total: number
  sent: number
  current: string
  phase: string
  isActive: boolean
}

interface Newsletter {
  id: string
  subject: string
  templateId: string
  campaignId: string
  sentAt: string
  audienceType: string
  total: number
  sent: number
  failed: number
  emailContent?: string
  stats: {
    sent: number
    opened: number
    clicked: number
    openRate: string
    clickRate: string
    veryActiveOpened?: number
    activeOpened?: number
    dormantOpened?: number
  }
}

interface UsersModalMetrics {
  veryActive: number
  veryActivePercentage: number
  active: number
  totalActive: number
  activePercentage: number
}

interface UsersModalData {
  users: User[]
  eventType: string
  campaignId: string
  total?: number
  metrics?: UsersModalMetrics | null
}

interface TemplateStatItem {
  templateId: string
  totalSent: number
  totalOpened: number
  totalClicked: number
  uniqueOpeners?: number
  uniqueClickers?: number
  openRate: number
  clickRate: number
  lastSent?: string
}

interface TemplateStats {
  [templateId: string]: TemplateStatItem
}

export default function NewslettersPage() {
  const { user } = useAuth() as { user: { id: string; email: string } | null }
  const [loading, setLoading] = useState(false)
  const [audienceStats, setAudienceStats] = useState<AudienceStats | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  // Form state
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['all'])
  const [testMode, setTestMode] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Email statistics state
  const [templateStats, setTemplateStats] = useState<TemplateStats>({})
  const [loadingStats, setLoadingStats] = useState(false)

  // User selection state
  const [selectionMode, setSelectionMode] = useState<'audience' | 'individual'>('audience')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPagination, setUserPagination] = useState<UserPagination | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Template management state
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loadedCustomTemplate, setLoadedCustomTemplate] = useState<Template | null>(null)

  // 📧 Progress state for sending newsletters
  const [sendingProgress, setSendingProgress] = useState<SendingProgress>({
    total: 0,
    sent: 0,
    current: '',
    phase: '',
    isActive: false
  })

  // 📑 Tab state
  const [activeTab, setActiveTab] = useState<'enviar' | 'historial'>('enviar')

  // 📊 History state
  const [history, setHistory] = useState<Newsletter[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null)

  // 👥 Users modal state
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [usersModalData, setUsersModalData] = useState<UsersModalData>({ users: [], eventType: '', campaignId: '' })
  const [loadingUsers_modal, setLoadingUsersModal] = useState(false)
  const [usersSearchQuery, setUsersSearchQuery] = useState('')

  // Cargar estadísticas de audiencia al montar
  useEffect(() => {
    loadAudienceStats()
    loadTemplateStats()
  }, [])

  // Debug cuando cambian las template stats
  useEffect(() => {
    if (Object.keys(templateStats).length > 0) {
      console.log('📊 Template stats cargadas:', Object.keys(templateStats).length)
    }
  }, [templateStats])

  // Cargar usuarios cuando cambia el modo de selección
  useEffect(() => {
    if (selectionMode === 'individual') {
      loadUsers()
    }
  }, [selectionMode, selectedAudiences, userSearch, userPage])

  // Cargar plantillas guardadas desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('newsletter-templates')
      if (saved) {
        setSavedTemplates(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error)
    }
  }, [])

  const loadAudienceStats = async () => {
    try {
      const response = await fetch('/api/admin/newsletters/audience')
      const data = await response.json()
      if (data.success) {
        setAudienceStats(data.audienceStats)
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch('/api/admin/newsletters/history')
      const data = await response.json()

      if (data.success) {
        setHistory(data.newsletters)
      } else {
        console.error('Error cargando historial:', data.error)
      }
    } catch (error) {
      console.error('Error cargando historial:', error)
    }
    setLoadingHistory(false)
  }

  // Cargar usuarios de una campaña específica
  const loadCampaignUsers = async (newsletter, eventType, eventLabel, activityFilter = null) => {
    setLoadingUsersModal(true)
    setShowUsersModal(true)
    setUsersSearchQuery('')

    try {
      // Extraer template_id y fecha del newsletter
      const sentDate = new Date(newsletter.sentAt)
      const dateKey = `${sentDate.getFullYear()}-${String(sentDate.getMonth() + 1).padStart(2, '0')}-${String(sentDate.getDate()).padStart(2, '0')}`

      const response = await fetch(
        `/api/admin/newsletters/history?templateId=${encodeURIComponent(newsletter.templateId)}&date=${dateKey}&eventType=${eventType}`
      )
      const data = await response.json()

      if (data.success) {
        // Filtrar usuarios por nivel de actividad si se especifica
        let filteredUsers = data.users
        if (activityFilter) {
          filteredUsers = data.users.filter(user => user.activityLevel === activityFilter)
        }

        setUsersModalData({
          users: filteredUsers,
          eventType: eventLabel,
          campaignId: newsletter.campaignId,
          total: filteredUsers.length,
          metrics: data.metrics || null
        })
      } else {
        console.error('Error cargando usuarios:', data.error)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    }
    setLoadingUsersModal(false)
  }

  // Cargar historial cuando se cambia al tab de historial
  useEffect(() => {
    if (activeTab === 'historial' && history.length === 0) {
      loadHistory()
    }
  }, [activeTab])

  const loadTemplateStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch('/api/admin/newsletters/template-stats')
      const data = await response.json()
      
      if (data.success) {
        setTemplateStats(data.templateStats)
      } else {
        console.error('❌ Error cargando template stats:', data.error)
      }
    } catch (error) {
      console.error('❌ Error cargando estadísticas de plantillas:', error)
    }
    setLoadingStats(false)
  }

  // Helper para obtener estadísticas de una plantilla específica
  const getTemplateStats = (templateId) => {
    return templateStats[templateId] || null
  }

  const loadUsers = async () => {
    if (selectionMode !== 'individual') return
    
    setLoadingUsers(true)
    try {
      const audienceType = selectedAudiences.length === 1 ? selectedAudiences[0] : 'all'
      const params = new URLSearchParams({
        audienceType,
        search: userSearch,
        page: userPage.toString(),
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/newsletters/users?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setUsers(data.users)
        setUserPagination(data.pagination)
      } else {
        console.error('❌ Error cargando usuarios:', data.error)
      }
    } catch (error) {
      console.error('❌ Error cargando usuarios:', error)
    }
    setLoadingUsers(false)
  }

  const toggleUser = (userId) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const selectAllUsers = () => {
    const allUserIds = new Set(users.map(u => u.id))
    setSelectedUsers(allUserIds)
  }

  const clearAllUsers = () => {
    setSelectedUsers(new Set())
  }

  // Template management functions
  const saveTemplate = () => {
    if (!subject.trim() || !htmlContent.trim()) {
      alert('Por favor, completa el asunto y contenido antes de guardar')
      return
    }

    const name = templateName.trim() || `Plantilla ${new Date().toLocaleDateString('es-ES')}`

    const newTemplate = {
      id: Date.now().toString(),
      name: name,
      subject: subject,
      content: htmlContent,
      createdAt: new Date().toISOString()
    }

    const updatedTemplates = [...savedTemplates, newTemplate]
    setSavedTemplates(updatedTemplates)
    localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
    
    setTemplateName('')
    setShowSaveTemplate(false)
    alert('Plantilla guardada exitosamente!')
  }

  const loadTemplate = (template) => {
    setSubject(template.subject)
    setHtmlContent(template.content)
    setSelectedTemplate(null) // Limpiar plantilla predefinida
    setLoadedCustomTemplate(template) // Establecer plantilla personalizada cargada
    setShowPreview(true) // Mostrar en modo preview
    alert('Plantilla cargada exitosamente!')
  }

  const duplicateTemplate = (template) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copia)`,
      createdAt: new Date().toISOString()
    }
    
    const updatedTemplates = [...savedTemplates, newTemplate]
    setSavedTemplates(updatedTemplates)
    localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
    alert('Plantilla duplicada exitosamente!')
  }

  const deleteTemplate = (templateId) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
      const updatedTemplates = savedTemplates.filter(t => t.id !== templateId)
      setSavedTemplates(updatedTemplates)
      localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
      alert('Plantilla eliminada exitosamente!')
    }
  }

  const startEditingTemplateName = (template) => {
    setEditingTemplate(template.id)
    setEditingTemplateName(template.name)
  }

  const saveTemplateName = (templateId) => {
    if (!editingTemplateName.trim()) {
      alert('El nombre no puede estar vacío')
      return
    }

    const updatedTemplates = savedTemplates.map(t => 
      t.id === templateId 
        ? { ...t, name: editingTemplateName.trim() }
        : t
    )
    setSavedTemplates(updatedTemplates)
    localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
    setEditingTemplate(null)
    setEditingTemplateName('')
  }

  const cancelEditingTemplateName = () => {
    setEditingTemplate(null)
    setEditingTemplateName('')
  }

  const retryFailedEmails = async () => {
    if (!result || !result.errors || result.errors.length === 0) return

    const failedEmails = result.errors.map(error => error.email)
    console.log('🔄 Reintentando emails fallidos:', failedEmails)

    const confirmMessage = `¿Reintentar envío a ${failedEmails.length} usuarios que fallaron?`
    if (!confirm(confirmMessage)) return

    setLoading(true)

    try {
      // Buscar los IDs de usuarios por email
      const { data: failedUsers } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('email', failedEmails)
        .not('email', 'is', null)

      if (!failedUsers || failedUsers.length === 0) {
        alert('No se encontraron usuarios para reenviar')
        return
      }

      // Enviar usando el endpoint con usuarios específicos
      const response = await fetch('/api/admin/newsletters/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject,
          htmlContent,
          selectedUserIds: failedUsers.map(u => u.id),
          audienceType: 'retry',
          testMode: false
        })
      })

      const retryResult = await response.json()
      
      // Actualizar el resultado combinando con el anterior
      const updatedResult = {
        ...result,
        total: result.total,
        sent: result.sent + (retryResult.sent || 0),
        failed: retryResult.failed || 0,
        errors: retryResult.errors || [],
        retryAttempted: true,
        lastRetryResult: retryResult
      }

      setResult(updatedResult)

      if (retryResult.success) {
        alert(`✅ Reintento exitoso: ${retryResult.sent} emails enviados, ${retryResult.failed} fallaron`)
      } else {
        alert(`⚠️ Reintento parcial: ${retryResult.sent || 0} enviados, ${retryResult.failed || 0} siguen fallando`)
      }

    } catch (error) {
      console.error('Error en reintento:', error)
      alert('Error al reintentar envío')
    }
    setLoading(false)
  }

  const toggleAudience = (audienceValue) => {
    setSelectedAudiences(prev => {
      if (prev.includes(audienceValue)) {
        return prev.filter(a => a !== audienceValue)
      } else {
        return [...prev, audienceValue]
      }
    })
  }

  const selectAllAudiences = () => {
    setSelectedAudiences(audienceOptions.map(option => option.value))
  }

  const clearAllAudiences = () => {
    setSelectedAudiences([])
  }

  const getTotalRecipients = (): number => {
    if (selectionMode === 'individual') {
      return selectedUsers.size
    }
    if (!audienceStats) return 0
    return selectedAudiences.reduce((total, audience) => {
      // Buscar primero en byOposicion para audiencias de oposición
      const byOposicion = audienceStats.byOposicion?.find(o => o.key === audience)
      if (byOposicion) {
        return total + byOposicion.count
      }
      // Para audiencias generales
      const value = audienceStats[audience]
      if (typeof value === 'number') {
        return total + value
      }
      return total
    }, 0)
  }

  const sendNewsletter = async () => {
    if (!subject.trim() || !htmlContent.trim()) {
      alert('Por favor completa el asunto y contenido HTML')
      return
    }

    if (selectionMode === 'audience' && selectedAudiences.length === 0) {
      alert('Por favor selecciona al menos una audiencia')
      return
    }

    if (selectionMode === 'individual' && selectedUsers.size === 0) {
      alert('Por favor selecciona al menos un usuario')
      return
    }

    const totalRecipients = getTotalRecipients()
    
    let confirmMessage
    if (selectionMode === 'individual') {
      confirmMessage = `¿Enviar newsletter a ${totalRecipients} usuarios seleccionados?`
    } else {
      const audienceNames = selectedAudiences.map(aud => 
        audienceOptions.find(opt => opt.value === aud)?.label
      ).join(', ')
      confirmMessage = `¿Enviar newsletter a ${totalRecipients.toLocaleString()} usuarios?\n\nAudiencias: ${audienceNames}`
    }

    if (!confirm(confirmMessage)) return

    setLoading(true)
    setResult(null)
    
    // 📧 Initialize progress tracking
    const totalAudiences = selectionMode === 'individual' ? 1 : selectedAudiences.length
    setSendingProgress({
      total: totalAudiences,
      sent: 0,
      current: '',
      phase: 'Iniciando envío...',
      isActive: true
    })
    
    try {
      if (selectionMode === 'individual') {
        // Envío a usuarios específicos
        setSendingProgress(prev => ({
          ...prev,
          current: 'Usuarios seleccionados',
          phase: `Enviando a ${selectedUsers.size} usuarios seleccionados...`
        }))
        
        const response = await fetch('/api/admin/newsletters/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject,
            htmlContent,
            selectedUserIds: Array.from(selectedUsers),
            audienceType: 'custom',
            testMode,
            templateId: selectedTemplate // Añadir el ID de la plantilla seleccionada
          })
        })

        const data = await response.json()
        
        setSendingProgress(prev => ({
          ...prev,
          sent: 1,
          phase: 'Completado!'
        }))
        
        setResult({
          ...data,
          audienceType: 'usuarios seleccionados',
          audiences: [{ audienceName: 'Usuarios seleccionados', ...data }]
        })
      } else {
        // Enviar a cada audiencia por separado
        const results = []
        
        for (let i = 0; i < selectedAudiences.length; i++) {
          const audienceType = selectedAudiences[i]
          const audienceName = audienceOptions.find(opt => opt.value === audienceType)?.label || audienceType
          const audienceCount = audienceStats[audienceType] || 0
          
          // Update progress for current audience
          setSendingProgress(prev => ({
            ...prev,
            current: audienceName,
            phase: `Enviando a ${audienceName} (${audienceCount.toLocaleString()} usuarios)...`,
            sent: i
          }))
          const response = await fetch('/api/admin/newsletters/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subject,
              htmlContent,
              audienceType,
              testMode,
              templateId: selectedTemplate // Añadir el ID de la plantilla seleccionada
            })
          })

          const data = await response.json()
          results.push({
            ...data,
            audienceType,
            audienceName: audienceOptions.find(opt => opt.value === audienceType)?.label
          })

          // Update progress after sending to this audience
          setSendingProgress(prev => ({
            ...prev,
            sent: i + 1,
            phase: i === selectedAudiences.length - 1 
              ? 'Completado!' 
              : `${i + 1}/${selectedAudiences.length} audiencias enviadas. Continuando...`
          }))

          // Pequeña pausa entre audiencias para no saturar
          if (selectedAudiences.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        // Consolidar resultados
        const consolidatedResult = {
          success: results.every(r => r.success),
          total: results.reduce((sum, r) => sum + (r.total || 0), 0),
          sent: results.reduce((sum, r) => sum + (r.sent || 0), 0),
          failed: results.reduce((sum, r) => sum + (r.failed || 0), 0),
          testMode,
          audiences: results,
          errors: results.flatMap(r => r.errors || [])
        }

        setResult(consolidatedResult)

        if (consolidatedResult.success && !testMode) {
          // Limpiar formulario después de envío exitoso en modo real
          setSelectedTemplate(null)
          setLoadedCustomTemplate(null)
          setSubject('')
          setHtmlContent('')
          setSelectedAudiences(['all'])
        }
      }

      // Limpiar formulario para modo individual
      if (selectionMode === 'individual' && result?.success && !testMode) {
        setSelectedTemplate(null)
        setLoadedCustomTemplate(null)
        setSubject('')
        setHtmlContent('')
        setSelectedUsers(new Set())
      }
    } catch (error) {
      console.error('Error enviando newsletter:', error)
      setSendingProgress(prev => ({
        ...prev,
        phase: 'Error durante el envío',
        isActive: false
      }))
      setResult({
        success: false,
        error: 'Error de conexión'
      })
    }
    setLoading(false)
    // Keep progress visible for a moment after completion
    setTimeout(() => {
      setSendingProgress(prev => ({ ...prev, isActive: false }))
    }, 2000)
  }

  // Opciones generales de audiencia
  const generalAudienceOptions = [
    { value: 'all', label: 'Todos los usuarios', description: 'Todos los usuarios registrados', group: 'general' },
    { value: 'active', label: 'Usuarios activos', description: 'Usuarios con actividad reciente', group: 'general' },
    { value: 'inactive', label: 'Usuarios inactivos', description: 'Usuarios sin actividad reciente', group: 'general' },
    { value: 'premium', label: 'Usuarios premium', description: 'Usuarios con suscripción activa', group: 'general' },
    { value: 'free', label: 'Usuarios gratuitos', description: 'Usuarios sin suscripción', group: 'general' }
  ]

  // Opciones de audiencia por oposición (values deben coincidir con target_oposicion en BD)
  const oposicionAudienceOptions: AudienceOption[] = [
    { value: 'auxiliar_administrativo_estado', label: 'Auxiliar Administrativo', description: 'Usuarios preparando Auxiliar Administrativo del Estado', group: 'oposicion' },
    { value: 'administrativo_estado', label: 'Administrativo', description: 'Usuarios preparando Administrativo del Estado', group: 'oposicion' },
    { value: 'tramitacion_procesal', label: 'Tramitación Procesal', description: 'Usuarios preparando Tramitación Procesal', group: 'oposicion' },
    { value: 'auxilio_judicial', label: 'Auxilio Judicial', description: 'Usuarios preparando Auxilio Judicial', group: 'oposicion' },
    { value: 'gestion_procesal', label: 'Gestión Procesal', description: 'Usuarios preparando Gestión Procesal', group: 'oposicion' }
  ]

  // Combinar todas las opciones
  const audienceOptions = [...generalAudienceOptions, ...oposicionAudienceOptions]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            📧 Sistema de Newsletters
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Envía comunicaciones masivas a tus usuarios con control total
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('enviar')}
                className={`${
                  activeTab === 'enviar'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📤 Enviar Newsletter
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={`${
                  activeTab === 'historial'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📊 Historial de Envíos
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content: Enviar */}
        {activeTab === 'enviar' && (
          <>
        {/* Stats Cards - Generales */}
        {audienceStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              {generalAudienceOptions.map(option => (
                <div key={option.value} className="bg-white rounded-lg shadow p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {audienceStats[option.value]?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {option.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Cards - Por Oposición */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Por oposición</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(audienceStats.byOposicion || oposicionAudienceOptions).map(item => {
                  const option = item.key ? item : oposicionAudienceOptions.find(o => o.value === item.value)
                  const count = item.count ?? audienceStats[item.value] ?? 0
                  const key = item.key || item.value
                  const label = item.name || option?.label || key
                  return (
                    <div key={key} className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
                      <div className="text-xl font-bold text-purple-600">
                        {count.toLocaleString()}
                      </div>
                      <div className="text-xs font-medium text-gray-600 truncate">
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              

              {/* Subject */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asunto del email
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="ej: 🚀 ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Selection Mode Toggle */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Método de selección
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="selectionMode"
                      value="audience"
                      checked={selectionMode === 'audience'}
                      onChange={() => setSelectionMode('audience')}
                      className="mr-2"
                    />
                    <span className="text-sm">Por audiencia (grupos)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="selectionMode"
                      value="individual"
                      checked={selectionMode === 'individual'}
                      onChange={() => setSelectionMode('individual')}
                      className="mr-2"
                    />
                    <span className="text-sm">Individual (usuario por usuario)</span>
                  </label>
                </div>
              </div>

              {/* Audience or User Selector */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {selectionMode === 'audience' ? 'Audiencia objetivo' : 'Usuarios objetivo'} ({getTotalRecipients().toLocaleString()} usuarios)
                  </label>
                  {selectionMode === 'audience' ? (
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllAudiences}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        ✓ Todos
                      </button>
                      <button
                        type="button"
                        onClick={clearAllAudiences}
                        className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        ✗ Ninguno
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllUsers}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        disabled={loadingUsers || !users.length}
                      >
                        ✓ Todos
                      </button>
                      <button
                        type="button"
                        onClick={clearAllUsers}
                        className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        ✗ Ninguno
                      </button>
                    </div>
                  )}
                </div>
                
                {selectionMode === 'audience' ? (
                  <div className="space-y-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                    {/* Opciones generales */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Audiencias generales</h4>
                      <div className="space-y-2">
                        {generalAudienceOptions.map(option => (
                          <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAudiences.includes(option.value)}
                              onChange={() => toggleAudience(option.value)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-900">
                                  {option.label}
                                </span>
                                <span className="text-sm font-bold text-blue-600">
                                  {audienceStats?.[option.value]?.toLocaleString() || 0} usuarios
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">{option.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Opciones por oposición */}
                    <div className="border-t border-gray-200 pt-3">
                      <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Por oposición</h4>
                      <div className="space-y-2">
                        {oposicionAudienceOptions.map(option => {
                          // Buscar el conteo en byOposicion o usar el valor directo
                          const byOposicion = audienceStats?.byOposicion?.find(o => o.key === option.value)
                          const count = byOposicion?.count ?? audienceStats?.[option.value] ?? 0
                          return (
                            <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedAudiences.includes(option.value)}
                                onChange={() => toggleAudience(option.value)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-900">
                                    {option.label}
                                  </span>
                                  <span className="text-sm font-bold text-purple-600">
                                    {count.toLocaleString()} usuarios
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500">{option.description}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Filtro de audiencia base para usuarios individuales */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filtrar por audiencia base:
                      </label>
                      <select
                        value={selectedAudiences.length === 1 ? selectedAudiences[0] : 'all'}
                        onChange={(e) => {
                          setSelectedAudiences([e.target.value])
                          setUserPage(1)
                          setSelectedUsers(new Set())
                        }}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        {audienceOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({audienceStats?.[option.value]?.toLocaleString() || 0} usuarios)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Búsqueda de usuarios */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Buscar usuarios por email o nombre..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value)
                          setUserPage(1)
                        }}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    {/* Lista de usuarios */}
                    <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                      {loadingUsers ? (
                        <div className="p-4 text-center text-gray-500">
                          🔄 Cargando usuarios...
                        </div>
                      ) : users.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No se encontraron usuarios
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {users.map(user => (
                            <label key={user.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(user.id)}
                                onChange={() => toggleUser(user.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-900 truncate">
                                    {user.full_name || 'Sin nombre'}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {new Date(user.created_at).toLocaleDateString('es-ES')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Paginación */}
                    {userPagination && userPagination.totalPages > 1 && (
                      <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-gray-500">
                          Página {userPagination.page} de {userPagination.totalPages}
                          ({userPagination.total} usuarios total)
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setUserPage(userPage - 1)}
                            disabled={userPage <= 1}
                            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={() => setUserPage(userPage + 1)}
                            disabled={!userPagination.hasMore}
                            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Siguiente →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Validación de selecciones */}
                {selectionMode === 'audience' && selectedAudiences.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Selecciona al menos una audiencia
                  </p>
                )}
                {selectionMode === 'individual' && selectedUsers.size === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Selecciona al menos un usuario
                  </p>
                )}
                
                {/* Resumen de selecciones */}
                {((selectionMode === 'audience' && selectedAudiences.length > 0) || 
                  (selectionMode === 'individual' && selectedUsers.size > 0)) && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      📋 {selectionMode === 'audience' ? 'Audiencias seleccionadas' : 'Usuarios seleccionados'} ({getTotalRecipients().toLocaleString()} usuarios total):
                    </h4>
                    <div className="space-y-1">
                      {selectionMode === 'audience' ? (
                        selectedAudiences.map(audienceValue => {
                          const option = audienceOptions.find(opt => opt.value === audienceValue)
                          const count = audienceStats?.[audienceValue] || 0
                          return (
                            <div key={audienceValue} className="flex justify-between items-center text-sm">
                              <span className="text-blue-700 font-medium">
                                {option?.label}
                              </span>
                              <span className="text-blue-600 font-bold">
                                {count.toLocaleString()} usuarios
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-sm text-blue-700">
                          {selectedUsers.size} usuarios seleccionados individualmente
                          {selectedUsers.size <= 5 && users.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {Array.from(selectedUsers).slice(0, 5).map(userId => {
                                const user = users.find(u => u.id === userId)
                                return user ? (
                                  <div key={userId} className="text-xs text-blue-600">
                                    • {user.full_name || 'Sin nombre'} ({user.email})
                                  </div>
                                ) : null
                              })}
                              {selectedUsers.size > 5 && (
                                <div className="text-xs text-blue-500">
                                  ... y {selectedUsers.size - 5} más
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* HTML Content */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contenido HTML
                  </label>
                  <div className="flex space-x-2">
                    {(selectedTemplate || loadedCustomTemplate) && (
                      <button
                        onClick={() => {
                          if (loadedCustomTemplate) {
                            // Editar plantilla personalizada directamente
                            const updatedTemplates = savedTemplates.map(t => 
                              t.id === loadedCustomTemplate.id 
                                ? { ...t, subject: subject, content: htmlContent }
                                : t
                            )
                            setSavedTemplates(updatedTemplates)
                            localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
                            setLoadedCustomTemplate({ ...loadedCustomTemplate, subject: subject, content: htmlContent })
                            alert('✅ Cambios guardados en la plantilla!')
                          } else if (selectedTemplate) {
                            // Plantillas predefinidas - guardar como nueva
                            const defaultName = selectedTemplate === 'rebranding' 
                              ? '🚀 Rebranding → Vence (Editada)'
                              : '🎯 Filtrado por Leyes (Editada)'
                            
                            const templateName = prompt('Guardar como nueva plantilla:', defaultName)
                            if (templateName) {
                              const template = {
                                id: 'custom-' + Date.now(),
                                name: templateName,
                                subject: subject,
                                content: htmlContent,
                                createdAt: new Date().toISOString()
                              }
                              const updatedTemplates = [...savedTemplates, template]
                              setSavedTemplates(updatedTemplates)
                              localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
                              alert('✅ Plantilla guardada como nueva!')
                            }
                          }
                        }}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title={loadedCustomTemplate ? "Guardar cambios en esta plantilla" : "Guardar como nueva plantilla"}
                      >
                        💾 {loadedCustomTemplate ? 'Guardar Cambios' : 'Guardar Como Nueva'}
                      </button>
                    )}
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {showPreview ? '📝 Editar' : '👁️ Preview'}
                    </button>
                  </div>
                </div>
                
                {!showPreview ? (
                  <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="Pega aquí el HTML completo de tu newsletter..."
                    rows={20}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-lg p-4 bg-white max-h-96 overflow-auto">
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  </div>
                )}
                
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    💡 Variables disponibles para personalización:
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li><code className="bg-blue-100 px-1 rounded">{'{nombre}'}</code> o <code className="bg-blue-100 px-1 rounded">{'{user_name}'}</code> - Nombre del usuario</li>
                    <li><code className="bg-blue-100 px-1 rounded">{'{oposicion}'}</code> - Oposición del usuario (ej: Auxiliar Administrativo del Estado)</li>
                    <li><code className="bg-blue-100 px-1 rounded">{'{email}'}</code> - Email del usuario</li>
                  </ul>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={sendNewsletter}
                disabled={loading || !subject.trim() || !htmlContent.trim() || 
                  (selectionMode === 'audience' && selectedAudiences.length === 0) ||
                  (selectionMode === 'individual' && selectedUsers.size === 0)}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                  loading || !subject.trim() || !htmlContent.trim() ||
                  (selectionMode === 'audience' && selectedAudiences.length === 0) ||
                  (selectionMode === 'individual' && selectedUsers.size === 0)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? (
                  '⏳ Enviando...'
                ) : (
                  `📧 Enviar a ${getTotalRecipients().toLocaleString()} usuarios`
                )}
              </button>

              {/* Retry Failed Button - Solo aparece si hay errores */}
              {result && result.errors && result.errors.length > 0 && (
                <button
                  onClick={retryFailedEmails}
                  disabled={loading}
                  className="w-full mt-3 py-3 px-6 rounded-lg font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    '⏳ Reenviando...'
                  ) : (
                    `🔄 Reintentar ${result.errors.length} emails fallidos`
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-1">
            {result && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {result.success ? '✅ Resultado' : '❌ Error'}
                </h3>
                
                {result.success ? (
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">Total:</span> {result.total}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Enviados:</span> 
                      <span className="text-green-600 font-bold"> {result.sent}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Fallos:</span> 
                      <span className="text-red-600 font-bold"> {result.failed}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Audiencias:</span> {result.audiences?.map(a => a.audienceName).join(', ')}
                    </div>
                    
                    {result.retryAttempted && result.lastRetryResult && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                        <h5 className="text-sm font-medium text-orange-800 mb-1">🔄 Último reintento:</h5>
                        <div className="text-xs space-y-1 text-orange-700">
                          <div>Enviados: +{result.lastRetryResult.sent || 0}</div>
                          <div>Fallos: {result.lastRetryResult.failed || 0}</div>
                        </div>
                      </div>
                    )}
                    
                    {result.errors?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-red-600 mb-2">
                          Errores restantes ({result.errors.length}):
                        </h4>
                        <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                          {result.errors.slice(0, 10).map((error, i) => (
                            <div key={i} className="text-red-600">
                              {error.email}: {error.error}
                            </div>
                          ))}
                          {result.errors.length > 10 && (
                            <div className="text-red-500 font-medium">
                              ... y {result.errors.length - 10} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">{result.error}</p>
                    {result.details && (
                      <p className="text-sm mt-2">{result.details}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Templates Sidebar */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  📋 Plantillas
                </h3>
                <button
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  💾 Guardar Actual
                </button>
              </div>

              {/* Save Template Form */}
              {showSaveTemplate && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nombre de la plantilla"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveTemplate}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      ✅ Guardar
                    </button>
                    <button
                      onClick={() => setShowSaveTemplate(false)}
                      className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Plantillas guardadas */}
              {savedTemplates.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Mis Plantillas</h4>
                  <div className="space-y-2">
                    {savedTemplates.map((template) => (
                      <div key={template.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {editingTemplate === template.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingTemplateName}
                              onChange={(e) => setEditingTemplateName(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveTemplateName(template.id)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                ✅
                              </button>
                              <button
                                onClick={cancelEditingTemplateName}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mb-2">
                              <h5 className="font-medium text-gray-800 text-sm">
                                {template.name}
                              </h5>
                            </div>
                            <p className="text-xs text-gray-600 truncate mb-3">
                              {template.subject}
                            </p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => loadTemplate(template)}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium flex-1"
                                title="Cargar esta plantilla en el editor"
                              >
                                📥 Usar
                              </button>
                              <button
                                onClick={() => startEditingTemplateName(template)}
                                className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 shadow-sm font-medium"
                                title="Cambiar el nombre de la plantilla"
                              >
                                ✏️ Renombrar
                              </button>
                              <button
                                onClick={() => duplicateTemplate(template)}
                                className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium"
                                title="Crear una copia de esta plantilla"
                              >
                                📋 Duplicar
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                                title="Eliminar esta plantilla permanentemente"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plantillas rápidas predeterminadas */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Plantillas Rápidas</h4>
                  <button
                    onClick={loadTemplateStats}
                    disabled={loadingStats}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loadingStats ? '⏳' : '🔄'} Stats
                  </button>
                </div>
                
                {/* Emails activos en el sistema */}
                {Object.keys(templateStats).length > 0 && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h5 className="text-sm font-medium text-green-800 mb-2">📊 Emails enviados en el sistema (datos reales):</h5>
                    {Object.values(templateStats)
                      .filter(stats => stats.totalSent > 0)
                      .sort((a, b) => b.totalSent - a.totalSent)
                      .map(stats => (
                        <div key={stats.templateId} className="text-xs text-green-700 mb-1">
                          <strong>{stats.templateId}</strong>: {stats.totalSent} enviados, {stats.openRate.toFixed(1)}% open rate
                          {stats.lastSent && ` (último: ${new Date(stats.lastSent).toLocaleDateString('es-ES')})`}
                        </div>
                      ))
                    }
                    {Object.values(templateStats).filter(stats => stats.totalSent > 0).length === 0 && (
                      <div className="text-xs text-green-700">No hay emails enviados en los últimos 90 días</div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {/* Template 1: Rebranding */}
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${ 
                      selectedTemplate === 'rebranding' 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTemplate('rebranding')
                      setSubject('🚀 ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!')
                      setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ILoveTest es ahora Vence</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🚀 ¡Gran Noticia!</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">ILoveTest es ahora <strong>Vence</strong></p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que <strong>ILoveTest ha evolucionado</strong> y ahora se llama <strong>Vence</strong>.</p>
    
    <h2 style="color: #1e40af;">🎯 ¿Qué significa esto para ti?</h2>
    <ul>
      <li>✅ La misma calidad de preguntas de siempre</li>
      <li>✅ Las mismas funcionalidades que ya conoces</li>
      <li>✅ Tu progreso y estadísticas se mantienen intactos</li>
      <li>✅ Nuevas mejoras y funcionalidades en camino</li>
    </ul>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
      <p style="margin: 0; color: #1e40af; font-weight: bold;">🔗 Sigue practicando en: <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="color: #1e40af; text-decoration: none; border-bottom: 2px solid #3b82f6;">www.vence.es/auxiliar-administrativo-estado/test</a></p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`)
                      setShowPreview(true)
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-gray-800 text-sm">
                            🚀 Rebranding → Vence
                          </h5>
                          {selectedTemplate === 'rebranding' && (
                            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!
                        </p>
                        
                        {/* Estadísticas del template */}
                        {(() => {
                          const stats = getTemplateStats('rebranding')
                          return stats ? (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-blue-600">{stats.totalSent}</div>
                                <div className="text-xs text-gray-500">📧 Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-green-600">{stats.openRate.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">📖 Aperturas</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-purple-600">{stats.clickRate.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">👆 Clicks</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-orange-600">
                                  {stats.lastSent ? new Date(stats.lastSent).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">📅 Último</div>
                              </div>
                            </div>
                          ) : loadingStats ? (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">⏳ Cargando stats...</div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">📭 Sin envíos aún</div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    
                    {/* Botones de acción para plantilla seleccionada */}
                    {selectedTemplate === 'rebranding' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const templateName = prompt('Nombre para guardar:', '🚀 Rebranding → Vence')
                              if (templateName) {
                                const template = {
                                  id: 'rebranding-saved-' + Date.now(),
                                  name: templateName,
                                  subject: '🚀 ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!',
                                  content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ILoveTest es ahora Vence</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🚀 ¡Gran Noticia!</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">ILoveTest es ahora <strong>Vence</strong></p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que <strong>ILoveTest ha evolucionado</strong> y ahora se llama <strong>Vence</strong>.</p>
    
    <h2 style="color: #1e40af;">🎯 ¿Qué significa esto para ti?</h2>
    <ul>
      <li>✅ La misma calidad de preguntas de siempre</li>
      <li>✅ Las mismas funcionalidades que ya conoces</li>
      <li>✅ Tu progreso y estadísticas se mantienen intactos</li>
      <li>✅ Nuevas mejoras y funcionalidades en camino</li>
    </ul>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
      <p style="margin: 0; color: #1e40af; font-weight: bold;">🔗 Sigue practicando en: <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="color: #1e40af; text-decoration: none; border-bottom: 2px solid #3b82f6;">www.vence.es/auxiliar-administrativo-estado/test</a></p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`,
                                  createdAt: new Date().toISOString()
                                }
                                const updatedTemplates = [...savedTemplates, template]
                                setSavedTemplates(updatedTemplates)
                                localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
                                alert('Plantilla guardada!')
                              }
                            }}
                            className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 shadow-sm font-medium"
                            title="Guardar esta plantilla con un nombre personalizado"
                          >
                            ✏️ Renombrar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const template = {
                                id: 'rebranding-duplicated-' + Date.now(),
                                name: '🚀 Rebranding → Vence (Copia)',
                                subject: '🚀 ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!',
                                content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ILoveTest es ahora Vence</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🚀 ¡Gran Noticia!</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">ILoveTest es ahora <strong>Vence</strong></p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que <strong>ILoveTest ha evolucionado</strong> y ahora se llama <strong>Vence</strong>.</p>
    
    <h2 style="color: #1e40af;">🎯 ¿Qué significa esto para ti?</h2>
    <ul>
      <li>✅ La misma calidad de preguntas de siempre</li>
      <li>✅ Las mismas funcionalidades que ya conoces</li>
      <li>✅ Tu progreso y estadísticas se mantienen intactos</li>
      <li>✅ Nuevas mejoras y funcionalidades en camino</li>
    </ul>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
      <p style="margin: 0; color: #1e40af; font-weight: bold;">🔗 Sigue practicando en: <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="color: #1e40af; text-decoration: none; border-bottom: 2px solid #3b82f6;">www.vence.es/auxiliar-administrativo-estado/test</a></p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`,
                                createdAt: new Date().toISOString()
                              }
                              duplicateTemplate(template)
                            }}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium"
                            title="Duplicar esta plantilla y guardarla"
                          >
                            📋 Duplicar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de que quieres quitar esta plantilla de la selección?')) {
                                setSelectedTemplate(null)
                                setLoadedCustomTemplate(null)
                                setSubject('')
                                setHtmlContent('')
                                setShowPreview(false)
                              }
                            }}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                            title="Deseleccionar plantilla"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template 2: Filtrado por Leyes */}
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${ 
                      selectedTemplate === 'filtrado' 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTemplate('filtrado')
                      setSubject('🎯 Nueva funcionalidad: Filtrado por Leyes')
                      setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nueva funcionalidad: Filtrado por Leyes</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🎯 Nueva Funcionalidad</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">Filtrado por Leyes y Artículos específicos</p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que hemos lanzado una <strong>nueva funcionalidad revolucionaria</strong> que transformará tu forma de estudiar para las oposiciones.</p>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🎯 Filtrado Inteligente por Leyes</h2>
    <p>Ahora puedes <strong>filtrar preguntas por leyes específicas e incluso por artículos concretos</strong>, dándote un control total sobre tu preparación.</p>
    
    <div style="background: #e0f2fe; border: 1px solid #0277bd; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h4 style="color: #01579b; margin: 0 0 10px 0;">📍 ¿Dónde encuentras esta función?</h4>
      <p style="margin: 0; color: #0277bd;">
        <strong>1.</strong> Ve a cualquier <strong>tema</strong> en Vence<br>
        <strong>2.</strong> Haz clic en <strong>"Opciones de personalización"</strong><br>
        <strong>3.</strong> Selecciona <strong>"Filtrar por leyes"</strong><br>
        <strong>4.</strong> ¡Elige las leyes y artículos específicos que quieres practicar!
      </p>
    </div>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">✨ ¿Qué puedes hacer ahora?</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>📖 Estudiar ley por ley:</strong> Enfócate en una sola normativa hasta dominarla completamente</li>
        <li><strong>🔍 Artículos específicos:</strong> Practica solo los artículos que más te cuestan</li>
        <li><strong>🎯 Estrategia dirigida:</strong> Identifica tus puntos débiles y trabájalos específicamente</li>
        <li><strong>📈 Progreso gradual:</strong> Avanza paso a paso, ley a ley, artículo a artículo</li>
      </ul>
    </div>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🚀 Beneficios para tu Oposición</h2>
    
    <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #059669; margin: 0 0 10px 0;">💡 Estrategia de Estudio Inteligente</h4>
      <p style="margin: 0;">Estudia primero la teoría de una ley específica y luego practica SOLO preguntas de esa ley. ¡Consolidación garantizada!</p>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #d97706; margin: 0 0 10px 0;">🎯 Enfoque en Debilidades</h4>
      <p style="margin: 0;">¿Te cuesta el Título III de la Ley 39/2015? Filtra solo esos artículos y conviértelos en tu fortaleza.</p>
    </div>
    
    <div style="background: #ede9fe; border: 1px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #7c3aed; margin: 0 0 10px 0;">📊 Preparación Sistemática</h4>
      <p style="margin: 0;">Organiza tu estudio por bloques temáticos. Domina la Constitución, luego pasa a la LPAC, después a la LRJSP...</p>
    </div>
    
    <h3 style="color: #1e40af; margin-top: 30px;">📋 Leyes Disponibles:</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏛️ Constitución Española</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📄 Ley 39/2015 (LPAC)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏢 Ley 40/2015 (LRJSP)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🇪🇺 TUE y TFUE</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>⚖️ LO 6/1985 (Poder Judicial)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📊 Y muchas más...</strong>
      </div>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);">🚀 Comenzar Estudio Dirigido</a>
    </div>
    
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <h4 style="color: #334155; margin: 0 0 10px 0;">💪 Tu éxito está en los detalles</h4>
      <p style="margin: 0; color: #64748b; font-style: italic;">"No estudies todo a la vez. Domina ley por ley, artículo por artículo. La precisión es clave en las oposiciones."</p>
    </div>
    
    <div style="background: #fff7ed; border: 2px solid #fb923c; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="color: #ea580c; margin: 0 0 15px 0; font-size: 20px;">💬 ¡Tu opinión nos importa!</h3>
      <p style="margin: 0 0 15px 0; color: #9a3412; font-size: 16px;">¿Qué te parece esta nueva funcionalidad? ¿Hay algo más que te gustaría ver en Vence?</p>
      <p style="margin: 0; color: #7c2d12; font-weight: bold;">
        <strong>📧 Responde a este correo</strong> con tus sugerencias, ideas o cualquier feedback.<br>
        Leemos cada mensaje y nos ayuda a hacer Vence aún mejor para ti.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`)
                      setShowPreview(true)
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-gray-800 text-sm">
                            🎯 Filtrado por Leyes
                          </h5>
                          {selectedTemplate === 'filtrado' && (
                            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          Nueva funcionalidad: Filtrado por Leyes
                        </p>
                        
                        {/* Estadísticas del template */}
                        {(() => {
                          const stats = getTemplateStats('filtrado_leyes')
                          return stats ? (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-blue-600">{stats.totalSent}</div>
                                <div className="text-xs text-gray-500">📧 Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-green-600">{stats.openRate.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">📖 Aperturas</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-purple-600">{stats.clickRate.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">👆 Clicks</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-orange-600">
                                  {stats.lastSent ? new Date(stats.lastSent).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">📅 Último</div>
                              </div>
                            </div>
                          ) : loadingStats ? (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">⏳ Cargando stats...</div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">📭 Sin envíos aún</div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    
                    {/* Botones de acción para plantilla filtrado seleccionada */}
                    {selectedTemplate === 'filtrado' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const templateName = prompt('Nombre para guardar:', '🎯 Filtrado por Leyes')
                              if (templateName) {
                                const template = {
                                  id: 'filtrado-saved-' + Date.now(),
                                  name: templateName,
                                  subject: '🎯 Nueva funcionalidad: Filtrado por Leyes',
                                  content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nueva funcionalidad: Filtrado por Leyes</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🎯 Nueva Funcionalidad</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">Filtrado por Leyes y Artículos específicos</p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que hemos lanzado una <strong>nueva funcionalidad revolucionaria</strong> que transformará tu forma de estudiar para las oposiciones.</p>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🎯 Filtrado Inteligente por Leyes</h2>
    <p>Ahora puedes <strong>filtrar preguntas por leyes específicas e incluso por artículos concretos</strong>, dándote un control total sobre tu preparación.</p>
    
    <div style="background: #e0f2fe; border: 1px solid #0277bd; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h4 style="color: #01579b; margin: 0 0 10px 0;">📍 ¿Dónde encuentras esta función?</h4>
      <p style="margin: 0; color: #0277bd;">
        <strong>1.</strong> Ve a cualquier <strong>tema</strong> en Vence<br>
        <strong>2.</strong> Haz clic en <strong>"Opciones de personalización"</strong><br>
        <strong>3.</strong> Selecciona <strong>"Filtrar por leyes"</strong><br>
        <strong>4.</strong> ¡Elige las leyes y artículos específicos que quieres practicar!
      </p>
    </div>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">✨ ¿Qué puedes hacer ahora?</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>📖 Estudiar ley por ley:</strong> Enfócate en una sola normativa hasta dominarla completamente</li>
        <li><strong>🔍 Artículos específicos:</strong> Practica solo los artículos que más te cuestan</li>
        <li><strong>🎯 Estrategia dirigida:</strong> Identifica tus puntos débiles y trabájalos específicamente</li>
        <li><strong>📈 Progreso gradual:</strong> Avanza paso a paso, ley a ley, artículo a artículo</li>
      </ul>
    </div>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🚀 Beneficios para tu Oposición</h2>
    
    <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #059669; margin: 0 0 10px 0;">💡 Estrategia de Estudio Inteligente</h4>
      <p style="margin: 0;">Estudia primero la teoría de una ley específica y luego practica SOLO preguntas de esa ley. ¡Consolidación garantizada!</p>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #d97706; margin: 0 0 10px 0;">🎯 Enfoque en Debilidades</h4>
      <p style="margin: 0;">¿Te cuesta el Título III de la Ley 39/2015? Filtra solo esos artículos y conviértelos en tu fortaleza.</p>
    </div>
    
    <div style="background: #ede9fe; border: 1px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #7c3aed; margin: 0 0 10px 0;">📊 Preparación Sistemática</h4>
      <p style="margin: 0;">Organiza tu estudio por bloques temáticos. Domina la Constitución, luego pasa a la LPAC, después a la LRJSP...</p>
    </div>
    
    <h3 style="color: #1e40af; margin-top: 30px;">📋 Leyes Disponibles:</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏛️ Constitución Española</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📄 Ley 39/2015 (LPAC)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏢 Ley 40/2015 (LRJSP)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🇪🇺 TUE y TFUE</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>⚖️ LO 6/1985 (Poder Judicial)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📊 Y muchas más...</strong>
      </div>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);">🚀 Comenzar Estudio Dirigido</a>
    </div>
    
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <h4 style="color: #334155; margin: 0 0 10px 0;">💪 Tu éxito está en los detalles</h4>
      <p style="margin: 0; color: #64748b; font-style: italic;">"No estudies todo a la vez. Domina ley por ley, artículo por artículo. La precisión es clave en las oposiciones."</p>
    </div>
    
    <div style="background: #fff7ed; border: 2px solid #fb923c; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="color: #ea580c; margin: 0 0 15px 0; font-size: 20px;">💬 ¡Tu opinión nos importa!</h3>
      <p style="margin: 0 0 15px 0; color: #9a3412; font-size: 16px;">¿Qué te parece esta nueva funcionalidad? ¿Hay algo más que te gustaría ver en Vence?</p>
      <p style="margin: 0; color: #7c2d12; font-weight: bold;">
        <strong>📧 Responde a este correo</strong> con tus sugerencias, ideas o cualquier feedback.<br>
        Leemos cada mensaje y nos ayuda a hacer Vence aún mejor para ti.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`,
                                  createdAt: new Date().toISOString()
                                }
                                const updatedTemplates = [...savedTemplates, template]
                                setSavedTemplates(updatedTemplates)
                                localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
                                alert('Plantilla guardada!')
                              }
                            }}
                            className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 shadow-sm font-medium"
                            title="Guardar esta plantilla con un nombre personalizado"
                          >
                            ✏️ Renombrar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const template = {
                                id: 'filtrado-duplicated-' + Date.now(),
                                name: '🎯 Filtrado por Leyes (Copia)',
                                subject: '🎯 Nueva funcionalidad: Filtrado por Leyes',
                                content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nueva funcionalidad: Filtrado por Leyes</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
    <h1 style="margin: 0; font-size: 28px;">🎯 Nueva Funcionalidad</h1>
    <p style="margin: 10px 0 0; font-size: 18px;">Filtrado por Leyes y Artículos específicos</p>
  </div>
  
  <div style="padding: 30px 0;">
    <p>Hola <strong>{user_name}</strong>,</p>
    
    <p>Nos complace anunciarte que hemos lanzado una <strong>nueva funcionalidad revolucionaria</strong> que transformará tu forma de estudiar para las oposiciones.</p>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🎯 Filtrado Inteligente por Leyes</h2>
    <p>Ahora puedes <strong>filtrar preguntas por leyes específicas e incluso por artículos concretos</strong>, dándote un control total sobre tu preparación.</p>
    
    <div style="background: #e0f2fe; border: 1px solid #0277bd; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h4 style="color: #01579b; margin: 0 0 10px 0;">📍 ¿Dónde encuentras esta función?</h4>
      <p style="margin: 0; color: #0277bd;">
        <strong>1.</strong> Ve a cualquier <strong>tema</strong> en Vence<br>
        <strong>2.</strong> Haz clic en <strong>"Opciones de personalización"</strong><br>
        <strong>3.</strong> Selecciona <strong>"Filtrar por leyes"</strong><br>
        <strong>4.</strong> ¡Elige las leyes y artículos específicos que quieres practicar!
      </p>
    </div>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">✨ ¿Qué puedes hacer ahora?</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>📖 Estudiar ley por ley:</strong> Enfócate en una sola normativa hasta dominarla completamente</li>
        <li><strong>🔍 Artículos específicos:</strong> Practica solo los artículos que más te cuestan</li>
        <li><strong>🎯 Estrategia dirigida:</strong> Identifica tus puntos débiles y trabájalos específicamente</li>
        <li><strong>📈 Progreso gradual:</strong> Avanza paso a paso, ley a ley, artículo a artículo</li>
      </ul>
    </div>
    
    <h2 style="color: #1e40af; margin-top: 30px;">🚀 Beneficios para tu Oposición</h2>
    
    <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #059669; margin: 0 0 10px 0;">💡 Estrategia de Estudio Inteligente</h4>
      <p style="margin: 0;">Estudia primero la teoría de una ley específica y luego practica SOLO preguntas de esa ley. ¡Consolidación garantizada!</p>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #d97706; margin: 0 0 10px 0;">🎯 Enfoque en Debilidades</h4>
      <p style="margin: 0;">¿Te cuesta el Título III de la Ley 39/2015? Filtra solo esos artículos y conviértelos en tu fortaleza.</p>
    </div>
    
    <div style="background: #ede9fe; border: 1px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h4 style="color: #7c3aed; margin: 0 0 10px 0;">📊 Preparación Sistemática</h4>
      <p style="margin: 0;">Organiza tu estudio por bloques temáticos. Domina la Constitución, luego pasa a la LPAC, después a la LRJSP...</p>
    </div>
    
    <h3 style="color: #1e40af; margin-top: 30px;">📋 Leyes Disponibles:</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏛️ Constitución Española</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📄 Ley 39/2015 (LPAC)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🏢 Ley 40/2015 (LRJSP)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>🇪🇺 TUE y TFUE</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>⚖️ LO 6/1985 (Poder Judicial)</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center; font-size: 14px;">
        <strong>📊 Y muchas más...</strong>
      </div>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);">🚀 Comenzar Estudio Dirigido</a>
    </div>
    
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <h4 style="color: #334155; margin: 0 0 10px 0;">💪 Tu éxito está en los detalles</h4>
      <p style="margin: 0; color: #64748b; font-style: italic;">"No estudies todo a la vez. Domina ley por ley, artículo por artículo. La precisión es clave en las oposiciones."</p>
    </div>
    
    <div style="background: #fff7ed; border: 2px solid #fb923c; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="color: #ea580c; margin: 0 0 15px 0; font-size: 20px;">💬 ¡Tu opinión nos importa!</h3>
      <p style="margin: 0 0 15px 0; color: #9a3412; font-size: 16px;">¿Qué te parece esta nueva funcionalidad? ¿Hay algo más que te gustaría ver en Vence?</p>
      <p style="margin: 0; color: #7c2d12; font-weight: bold;">
        <strong>📧 Responde a este correo</strong> con tus sugerencias, ideas o cualquier feedback.<br>
        Leemos cada mensaje y nos ayuda a hacer Vence aún mejor para ti.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      El equipo de <strong>Vence</strong><br>
      <em>Preparando tu futuro, pregunta a pregunta</em>
    </p>
  </div>
</body>
</html>`,
                                createdAt: new Date().toISOString()
                              }
                              duplicateTemplate(template)
                            }}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium"
                            title="Duplicar esta plantilla y guardarla"
                          >
                            📋 Duplicar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de que quieres quitar esta plantilla de la selección?')) {
                                setSelectedTemplate(null)
                                setLoadedCustomTemplate(null)
                                setSubject('')
                                setHtmlContent('')
                                setShowPreview(false)
                              }
                            }}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                            title="Deseleccionar plantilla"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template 3: Modal Artículos Problemáticos */}
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${ 
                      selectedTemplate === 'modal_articulos' 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTemplate('modal_articulos')
                      setSubject('🎯 Ya no tienes que apuntarte qué artículos fallas - Vence los detecta automáticamente')
                      setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Artículos problemáticos detectados automáticamente</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 25px; border-radius: 12px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Vence Mejora</h1>
    <p style="color: #bfdbfe; margin: 8px 0; font-size: 16px;">Detección automática de artículos problemáticos</p>
  </div>
  
  <h2 style="color: #2563eb; font-size: 22px;">¡Hola {user_name}! 👋</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    <strong style="color: #dc2626;">¿Te cansas de apuntarte qué artículos fallas más?</strong> ¿Te olvidas de revisar esos artículos complicados en el BOE o en tus apuntes?
  </p>
  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    Hemos implementado una <strong>mejora</strong> que detecta automáticamente los artículos que más te cuestan y te facilita acceso instantáneo al texto completo.
  </p>
  
  <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 25px; margin: 25px 0; border-radius: 6px;">
    <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">🎯 Detección automática de artículos problemáticos</h3>
    <p style="margin-bottom: 15px; color: #1e40af; font-size: 15px; line-height: 1.6;">
      <strong>Vence analiza automáticamente tus respuestas</strong> e identifica los artículos que fallas más a menudo. 
      Ya no tienes que llevar la cuenta manualmente.
    </p>
    <h4 style="color: #1e40af; margin: 15px 0 10px 0; font-size: 16px;">📍 ¿Dónde lo encuentras?</h4>
    <div style="background: #dbeafe; padding: 15px; border-radius: 6px; margin: 10px 0;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: bold;">
        🔹 Ve a cualquier <strong>"Tema"</strong> en Vence<br>
        🔹 Baja hasta la sección <strong>"Análisis Inteligente de Estudio"</strong><br>
        🔹 Verás automáticamente los artículos que más fallas<br>
        🔹 Haz clic en <strong>"📖 Ver artículo"</strong> en cualquiera de ellos
      </p>
    </div>
  </div>
  
  <div style="background: #f0f9ff; border: 2px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px;">
    <h4 style="color: #1e40af; margin-top: 0; font-size: 16px; text-align: center;">📱 Simulación de lo que verás:</h4>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; font-family: monospace;">
      <div style="border: 2px solid #fbbf24; background: #fef3c7; border-radius: 6px; padding: 12px; margin: 8px 0;">
        <div style="font-weight: bold; color: #92400e; font-size: 14px;">📊 Art. 47 - Ley 39/2015 (LPAC)</div>
        <div style="color: #7c2d12; font-size: 12px; margin: 5px 0;">❌ 32% de aciertos • ⏱️ 45s promedio</div>
        <button style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">
          📖 Ver artículo 47 de Ley 39/2015 (LPAC)
        </button>
      </div>
    </div>
    <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 13px; text-align: center; font-style: italic;">
      ↑ Ejemplo de cómo aparecen los artículos problemáticos detectados automáticamente
    </p>
  </div>
  
  <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #7f1d1d; margin-top: 0; font-size: 16px;">😤 Lo que tenías que hacer antes (¡qué rollo!):</h4>
    <ul style="color: #7f1d1d; font-size: 14px; margin: 10px 0; padding-left: 20px;">
      <li><strong>Apuntarte manualmente</strong> qué artículos fallas</li>
      <li><strong>Recordar</strong> revisar esos artículos después</li>
      <li><strong>Buscar en el BOE</strong> o en tus apuntes el texto</li>
      <li><strong>Navegar fuera de Vence</strong> y perder el contexto</li>
      <li><strong>Volver</strong> y recordar dónde estabas</li>
    </ul>
  </div>
  
  <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #047857; margin-top: 0; font-size: 16px;">✨ Lo que ocurre ahora automáticamente:</h4>
    <ul style="color: #047857; font-size: 14px; margin: 10px 0; padding-left: 20px;">
      <li><strong>Vence detecta automáticamente</strong> qué artículos fallas más</li>
      <li><strong>Te los muestra organizados</strong> en "Análisis Inteligente de Estudio"</li>
      <li><strong>Haces 1 clic</strong> y se abre una ventana flotante</li>
      <li><strong>Lees el texto completo del artículo</strong> sin salir de Vence</li>
      <li><strong>Ves si ha aparecido en exámenes oficiales</strong> y con qué frecuencia</li>
      <li><strong>Cierras la ventana</strong> y sigues exactamente donde estabas</li>
    </ul>
  </div>
  
  <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h4 style="color: #92400e; margin-top: 0; font-size: 16px; text-align: center;">💝 Agradecimiento especial</h4>
    <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
      <strong>Gracias a Nila</strong>, una opositora como tú, por darnos esta idea y su feedback. 
      Las mejores funcionalidades nacen de quienes realmente preparan oposiciones. 🙏
    </p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);">
      🎯 Probar la Nueva Función
    </a>
  </div>
  
  
  <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
      <strong>💡 ¿Detectas algún problema o tienes ideas?</strong><br>
      Responde a este email o usa el <strong>botón de feedback</strong> en la aplicación. ¡Tu opinión nos ayuda a mejorar!
    </p>
  </div>
  
  <p style="margin-top: 30px;">
    <strong>Manuel</strong><br>
    <strong>Vence.es</strong><br>
    <em>Preparando tu futuro, pregunta a pregunta</em>
  </p>
</body>
</html>`)
                      setShowPreview(true)
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-gray-800 text-sm">
                            🎯 Modal Artículos Problemáticos
                          </h5>
                          {selectedTemplate === 'modal_articulos' && (
                            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          Detección automática + acceso inmediato al BOE
                        </p>
                        
                        {/* Estadísticas del template */}
                        {(() => {
                          const stats = getTemplateStats('modal_articulos')
                          return stats ? (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-blue-600">{stats.totalSent}</div>
                                <div className="text-xs text-gray-500">📧 Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-green-600">{stats.uniqueOpeners} ({stats.openRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">📖 Aperturas</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-purple-600">{stats.uniqueClickers} ({stats.clickRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">👆 Clicks</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-orange-600">
                                  {stats.lastSent ? new Date(stats.lastSent).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">📅 Último</div>
                              </div>
                            </div>
                          ) : loadingStats ? (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">⏳ Cargando stats...</div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">📭 Sin envíos aún</div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    
                    {/* Botones de acción para plantilla modal seleccionada */}
                    {selectedTemplate === 'modal_articulos' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const templateName = prompt('Nombre para guardar:', '🎯 Detección Automática Artículos Problemáticos')
                              if (templateName) {
                                const template = {
                                  id: 'modal-articulos-saved-' + Date.now(),
                                  name: templateName,
                                  subject: '🎯 Ya no tienes que apuntarte qué artículos fallas - Vence los detecta automáticamente',
                                  content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Modal inteligente para artículos problemáticos</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 25px; border-radius: 12px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Vence Mejora</h1>
    <p style="color: #a7f3d0; margin: 8px 0; font-size: 16px;">Flujo de estudio optimizado</p>
  </div>
  
  <h2 style="color: #059669; font-size: 22px;">¡Hola {user_name}! 👋</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    ¿Te pasaba que cuando querías consultar un artículo problemático <strong style="color: #dc2626;">perdías el hilo de tu análisis</strong>? 
    Hemos solucionado este problema con una mejora que te va a encantar.
  </p>
  
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 6px;">
    <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">🎯 Modal inteligente para artículos problemáticos</h3>
    <p style="margin-bottom: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
      Ahora puedes consultar la teoría de cualquier artículo problemático sin salir de tu página de análisis. 
      Una ventana flotante te muestra toda la información que necesitas.
    </p>
  </div>
  
  <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #7f1d1d; margin-top: 0; font-size: 16px;">😤 El problema que tenías antes:</h4>
    <p style="margin-bottom: 0; color: #7f1d1d; font-size: 14px;">
      Cuando aparecía un artículo problemático, tenías que hacer clic, ir a otra página, leer el artículo, 
      volver atrás, y recordar dónde estabas en tu análisis. <strong>Interrumpía tu concentración</strong> 
      y hacía que perdieras tiempo valioso.
    </p>
  </div>
  
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #1e3a8a; margin-top: 0; font-size: 16px;">✨ La solución que hemos implementado:</h4>
    <p style="margin-bottom: 0; color: #1e3a8a; font-size: 14px;">
      Modal (ventana flotante) que se abre sobre tu página actual. Lees el artículo completo, 
      ves si ha aparecido en exámenes oficiales, y cierras la ventana para continuar exactamente donde lo dejaste. 
      <strong>Sin navegación, sin pérdida de contexto.</strong>
    </p>
  </div>
  
  <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
    <h3 style="color: #059669; margin-top: 0; font-size: 18px; text-align: center;">🎉 Beneficios para ti como opositor:</h3>
    <ul style="list-style: none; padding: 0; margin: 15px 0;">
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>⚡ Acceso instantáneo a la teoría: consulta cualquier artículo en 1 click</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>🎯 Sin pérdida de contexto: mantén visible tu análisis de rendimiento</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>📚 Información completa: contenido del artículo + datos de exámenes oficiales</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>🚀 Flujo de estudio optimizado: estudia de forma más eficiente y fluida</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>📱 Funciona en móvil y ordenador: la misma experiencia en todos tus dispositivos</strong>
      </li>
    </ul>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://www.vence.es/auxiliar-administrativo-estado/test/tema/1" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
      🎯 Probar la Nueva Función
    </a>
  </div>
  
  
  <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
      <strong>💡 ¿Detectas algún problema o tienes ideas?</strong><br>
      Responde a este email o usa el <strong>botón de feedback</strong> en la aplicación. ¡Tu opinión nos ayuda a mejorar!
    </p>
  </div>
  
  <p style="margin-top: 30px;">
    <strong>Manuel</strong><br>
    <strong>Vence.es</strong><br>
    <em>Preparando tu futuro, pregunta a pregunta</em>
  </p>
</body>
</html>`,
                                  createdAt: new Date().toISOString()
                                }
                                const updatedTemplates = [...savedTemplates, template]
                                setSavedTemplates(updatedTemplates)
                                localStorage.setItem('newsletter-templates', JSON.stringify(updatedTemplates))
                                alert('Plantilla guardada!')
                              }
                            }}
                            className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 shadow-sm font-medium"
                            title="Guardar esta plantilla con un nombre personalizado"
                          >
                            ✏️ Renombrar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const template = {
                                id: 'modal-articulos-duplicated-' + Date.now(),
                                name: '🎯 Modal Artículos Problemáticos (Copia)',
                                subject: '🚀 Nueva mejora: consulta artículos sin perder tu progreso',
                                content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Modal inteligente para artículos problemáticos</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 25px; border-radius: 12px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Vence Mejora</h1>
    <p style="color: #a7f3d0; margin: 8px 0; font-size: 16px;">Flujo de estudio optimizado</p>
  </div>
  
  <h2 style="color: #059669; font-size: 22px;">¡Hola {user_name}! 👋</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    ¿Te pasaba que cuando querías consultar un artículo problemático <strong style="color: #dc2626;">perdías el hilo de tu análisis</strong>? 
    Hemos solucionado este problema con una mejora que te va a encantar.
  </p>
  
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 6px;">
    <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">🎯 Modal inteligente para artículos problemáticos</h3>
    <p style="margin-bottom: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
      Ahora puedes consultar la teoría de cualquier artículo problemático sin salir de tu página de análisis. 
      Una ventana flotante te muestra toda la información que necesitas.
    </p>
  </div>
  
  <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #7f1d1d; margin-top: 0; font-size: 16px;">😤 El problema que tenías antes:</h4>
    <p style="margin-bottom: 0; color: #7f1d1d; font-size: 14px;">
      Cuando aparecía un artículo problemático, tenías que hacer clic, ir a otra página, leer el artículo, 
      volver atrás, y recordar dónde estabas en tu análisis. <strong>Interrumpía tu concentración</strong> 
      y hacía que perdieras tiempo valioso.
    </p>
  </div>
  
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <h4 style="color: #1e3a8a; margin-top: 0; font-size: 16px;">✨ La solución que hemos implementado:</h4>
    <p style="margin-bottom: 0; color: #1e3a8a; font-size: 14px;">
      Modal (ventana flotante) que se abre sobre tu página actual. Lees el artículo completo, 
      ves si ha aparecido en exámenes oficiales, y cierras la ventana para continuar exactamente donde lo dejaste. 
      <strong>Sin navegación, sin pérdida de contexto.</strong>
    </p>
  </div>
  
  <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
    <h3 style="color: #059669; margin-top: 0; font-size: 18px; text-align: center;">🎉 Beneficios para ti como opositor:</h3>
    <ul style="list-style: none; padding: 0; margin: 15px 0;">
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>⚡ Acceso instantáneo a la teoría: consulta cualquier artículo en 1 click</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>🎯 Sin pérdida de contexto: mantén visible tu análisis de rendimiento</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>📚 Información completa: contenido del artículo + datos de exámenes oficiales</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>🚀 Flujo de estudio optimizado: estudia de forma más eficiente y fluida</strong>
      </li>
      <li style="margin: 8px 0; color: #059669; font-size: 15px;">
        <strong>📱 Funciona en móvil y ordenador: la misma experiencia en todos tus dispositivos</strong>
      </li>
    </ul>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://www.vence.es/auxiliar-administrativo-estado/test/tema/1" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
      🎯 Probar la Nueva Función
    </a>
  </div>
  
  
  <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
      <strong>💡 ¿Detectas algún problema o tienes ideas?</strong><br>
      Responde a este email o usa el <strong>botón de feedback</strong> en la aplicación. ¡Tu opinión nos ayuda a mejorar!
    </p>
  </div>
  
  <p style="margin-top: 30px;">
    <strong>Manuel</strong><br>
    <strong>Vence.es</strong><br>
    <em>Preparando tu futuro, pregunta a pregunta</em>
  </p>
</body>
</html>`,
                                createdAt: new Date().toISOString()
                              }
                              duplicateTemplate(template)
                            }}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium"
                            title="Duplicar esta plantilla y guardarla"
                          >
                            📋 Duplicar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de que quieres quitar esta plantilla de la selección?')) {
                                setSelectedTemplate(null)
                                setLoadedCustomTemplate(null)
                                setSubject('')
                                setHtmlContent('')
                                setShowPreview(false)
                              }
                            }}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                            title="Deseleccionar plantilla"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template 4: Lanzamiento Premium */}
                  <div
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedTemplate === 'lanzamiento_premium'
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTemplate('lanzamiento_premium')
                      setSubject('⚠️ Hoy Vence free se limita a 25 preguntas diarias. Hazte premium hoy antes de que suban los precios')
                      setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vence Premium - Cambio importante</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; border-radius: 12px;">
    <h1 style="color: white; margin: 0; font-size: 26px;">📢 Cambio importante en Vence</h1>
    <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 16px;">A partir de hoy</p>
  </div>

  <h2 style="color: #1f2937; font-size: 22px;">{user_name}, esto te afecta directamente</h2>

  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    Llevamos meses trabajando para ofrecerte la mejor plataforma de preparación de oposiciones.
    <strong>A partir de hoy, las cuentas gratuitas tendrán un límite de 25 preguntas al día.</strong>
  </p>

  <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 25px; border-radius: 12px; margin: 25px 0;">
    <h3 style="color: #7f1d1d; margin-top: 0; font-size: 18px;">🔒 Lo que cambia HOY para cuentas free:</h3>
    <ul style="color: #7f1d1d; font-size: 15px; margin: 15px 0; padding-left: 20px;">
      <li><strong>Máximo 25 preguntas al día</strong> - antes era ilimitado</li>
      <li>Se resetea cada día a medianoche</li>
      <li>Estadísticas y análisis limitados</li>
    </ul>
    <p style="margin: 0; color: #991b1b; font-size: 14px; font-style: italic;">
      Con 25 preguntas al día es muy difícil preparar una oposición de forma seria.
    </p>
  </div>

  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px solid #f59e0b; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
    <h3 style="color: #92400e; margin-top: 0; font-size: 20px;">🎁 SOLO HOY</h3>
    <div style="display: flex; justify-content: center; gap: 30px; margin: 20px 0; flex-wrap: wrap;">
      <div style="background: white; padding: 20px 30px; border-radius: 10px; border: 2px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 36px; font-weight: bold;">59€</p>
        <p style="margin: 5px 0 0 0; color: #b45309; font-size: 16px; font-weight: bold;">6 MESES</p>
        <p style="margin: 5px 0 0 0; color: #065f46; font-size: 13px;">= 9,83€/mes</p>
      </div>
      <div style="background: white; padding: 20px 30px; border-radius: 10px; border: 2px solid #e5e7eb;">
        <p style="margin: 0; color: #374151; font-size: 36px; font-weight: bold;">20€</p>
        <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 16px; font-weight: bold;">MENSUAL</p>
        <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 13px;">sin compromiso</p>
      </div>
    </div>
    <p style="margin: 15px 0 0 0; color: #dc2626; font-size: 14px; font-weight: bold;">
      ⚠️ Mañana los precios suben
    </p>
  </div>

  <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
    <h3 style="color: #065f46; margin-top: 0; font-size: 18px; text-align: center;">✨ Con Vence Premium tienes:</h3>
    <ul style="list-style: none; padding: 0; margin: 15px 0;">
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>Preguntas ILIMITADAS</strong> - estudia todo lo que necesites
      </li>
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>+20.000 preguntas</strong> de exámenes oficiales y generadas por IA
      </li>
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>Tests personalizados</strong> - por tema, ley, dificultad...
      </li>
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>Análisis inteligente</strong> - detecta tus puntos débiles automáticamente
      </li>
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>Estadísticas completas</strong> - tu progreso al detalle
      </li>
      <li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;">
        <span style="position: absolute; left: 0;">✅</span>
        <strong>Sin interrupciones</strong> - estudia cuando quieras, cuanto quieras
      </li>
    </ul>
  </div>

  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
    <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.6;">
      <strong>💡 Piénsalo así:</strong> ¿Cuánto vale para ti aprobar la oposición?
      Con Vence Premium puedes hacer 100, 200 o 500 preguntas al día si lo necesitas.
      <strong>Sin límites, sin excusas.</strong>
    </p>
  </div>

  <div style="text-align: center; margin: 35px 0;">
    <a href="https://www.vence.es/premium" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 22px 50px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);">
      🚀 Quiero Premium por 59€
    </a>
    <p style="margin: 15px 0 0 0; color: #dc2626; font-size: 14px; font-weight: bold;">
      ⏰ Solo hoy a este precio
    </p>
  </div>

  <p style="margin-top: 30px;">
    <strong>Manuel</strong><br>
    <strong>Vence.es</strong><br>
    <em>Preparando tu futuro, pregunta a pregunta</em>
  </p>
</body>
</html>`)
                      setShowPreview(true)
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-gray-800 text-sm">
                            🚀 Lanzamiento Premium
                          </h5>
                          {selectedTemplate === 'lanzamiento_premium' && (
                            <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded-full">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          Anuncio premium + 20% descuento solo hoy
                        </p>

                        {/* Estadísticas del template */}
                        {(() => {
                          const stats = getTemplateStats('lanzamiento_premium')
                          return stats ? (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-blue-600">{stats.totalSent}</div>
                                <div className="text-xs text-gray-500">📧 Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-green-600">{stats.uniqueOpeners} ({stats.openRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">📖 Aperturas</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-purple-600">{stats.uniqueClickers} ({stats.clickRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">👆 Clicks</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-orange-600">
                                  {stats.lastSent ? new Date(stats.lastSent).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">📅 Último</div>
                              </div>
                            </div>
                          ) : loadingStats ? (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">⏳ Cargando stats...</div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">📭 Sin envíos aún</div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Botones de acción para plantilla premium seleccionada */}
                    {selectedTemplate === 'lanzamiento_premium' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de que quieres quitar esta plantilla de la selección?')) {
                                setSelectedTemplate(null)
                                setLoadedCustomTemplate(null)
                                setSubject('')
                                setHtmlContent('')
                                setShowPreview(false)
                              }
                            }}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                            title="Deseleccionar plantilla"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template 5: Actualización de Leyes */}
                  <div
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedTemplate === 'actualizacion_leyes'
                        ? 'border-amber-500 bg-amber-50 shadow-md'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedTemplate('actualizacion_leyes')
                      setSubject('📋 Actualización importante para {oposicion}')
                      setHtmlContent(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualización de Leyes - Vence</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
        Actualización de Leyes
      </h1>
      <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">
        {oposicion}
      </p>
    </div>

    <!-- Saludo y resumen -->
    <div style="padding: 32px 24px 16px 24px;">
      <p style="margin: 0; font-size: 16px; color: #374151;">
        Hola <strong style="color: #1d4ed8;">{nombre}</strong>,
      </p>
      <p style="margin: 16px 0 0 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
        Esta semana se han actualizado <strong>6 leyes</strong> en el BOE, de las cuales <strong>1 afecta directamente</strong> a tu oposición de {oposicion}.
      </p>
    </div>

    <!-- Ley que SÍ afecta -->
    <div style="padding: 0 24px 24px 24px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937; display: flex; align-items: center;">
        <span style="background-color: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">TE AFECTA</span>
        Ley actualizada en tu temario
      </h2>

      <div style="padding: 20px; background-color: #fef2f2; border-radius: 8px; border: 2px solid #fecaca;">
        <div style="margin-bottom: 12px;">
          <span style="background-color: #dc2626; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            ACTUALIZADA 28/01/2026
          </span>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #991b1b;">
          RDL 8/2015 - Ley General de la Seguridad Social
        </h3>
        <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5;">
          El texto refundido de la Ley General de la Seguridad Social ha sido modificado. Esta ley forma parte del temario de {oposicion} y tiene <strong>93 preguntas</strong> en Vence.
        </p>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #991b1b;">
          Los cambios afectan a temas de prestaciones, cotizaciones y procedimientos de Seguridad Social.
        </p>
      </div>
    </div>

    <!-- CTA principal -->
    <div style="padding: 0 24px 24px 24px; text-align: center;">
      <a href="https://www.vence.es/leyes/rdl-8-2015-seguridad-social?utm_source=newsletter&utm_medium=email&utm_campaign=ley_actualizada"
         style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Repasar preguntas de Seguridad Social
      </a>
    </div>

    <!-- Leyes que NO afectan -->
    <div style="padding: 0 24px 24px 24px;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
        Otras leyes actualizadas (no afectan a tu oposición)
      </h2>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b7280; line-height: 1.8;">
          <li>Ley 31/2022 - Presupuestos Generales del Estado</li>
          <li>LIVA - Ley del IVA</li>
          <li>LIRPF - Ley del IRPF</li>
          <li>LIS - Ley del Impuesto sobre Sociedades</li>
          <li>RDL 2/2004 - Haciendas Locales</li>
        </ul>
      </div>
    </div>

    <!-- Info box -->
    <div style="margin: 0 24px 24px 24px; padding: 20px; background-color: #eff6ff; border-radius: 8px;">
      <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.6;">
        <strong>Los tests de Vence ya están actualizados.</strong> Las preguntas reflejan los últimos cambios normativos para que estudies siempre con el contenido vigente.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
        Enviado a {email}
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Vence - Preparación de oposiciones
      </p>
    </div>

  </div>
</body>
</html>`)
                      setShowPreview(true)
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-gray-800 text-sm">
                            📋 Actualización de Leyes
                          </h5>
                          {selectedTemplate === 'actualizacion_leyes' && (
                            <span className="px-2 py-1 text-xs bg-amber-600 text-white rounded-full">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          Informar sobre cambios detectados en el BOE
                        </p>

                        {/* Estadísticas del template */}
                        {(() => {
                          const stats = getTemplateStats('actualizacion_leyes')
                          return stats ? (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-blue-600">{stats.totalSent}</div>
                                <div className="text-xs text-gray-500">📧 Enviados</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-green-600">{stats.uniqueOpeners} ({stats.openRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">📖 Aperturas</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-purple-600">{stats.uniqueClickers} ({stats.clickRate.toFixed(1)}%)</div>
                                <div className="text-xs text-gray-500">👆 Clicks</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-orange-600">
                                  {stats.lastSent ? new Date(stats.lastSent).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">📅 Último</div>
                              </div>
                            </div>
                          ) : loadingStats ? (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">⏳ Cargando stats...</div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center">
                              <div className="text-xs text-gray-500">📭 Sin envíos aún</div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Botones de acción para plantilla actualización leyes seleccionada */}
                    {selectedTemplate === 'actualizacion_leyes' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de que quieres quitar esta plantilla de la selección?')) {
                                setSelectedTemplate(null)
                                setLoadedCustomTemplate(null)
                                setSubject('')
                                setHtmlContent('')
                                setShowPreview(false)
                              }
                            }}
                            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium"
                            title="Deseleccionar plantilla"
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        </>
        )}

        {/* Tab Content: Historial */}
        {activeTab === 'historial' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                📊 Historial de Newsletters Enviadas
              </h2>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
              >
                {loadingHistory ? 'Cargando...' : '🔄 Actualizar'}
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No se han enviado newsletters aún
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Asunto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Plantilla
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Enviados
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Abiertos
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1">
                          <span>Muy Activos</span>
                          <div className="group relative">
                            <button className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 text-white text-xs flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors">
                              ?
                            </button>
                            <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg">
                              <div className="font-semibold mb-1">Muy Activos (30 días)</div>
                              <div className="text-gray-300 dark:text-gray-200">
                                Usuarios que hicieron al menos un test en los últimos 30 días
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                            </div>
                          </div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1">
                          <span>Activos</span>
                          <div className="group relative">
                            <button className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 text-white text-xs flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors">
                              ?
                            </button>
                            <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg">
                              <div className="font-semibold mb-1">Activos (90 días)</div>
                              <div className="text-gray-300 dark:text-gray-200">
                                Usuarios que hicieron al menos un test en los últimos 90 días
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                            </div>
                          </div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Open Rate
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        CTR
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {history.map((newsletter) => (
                      <tr key={newsletter.campaignId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {new Date(newsletter.sentAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {newsletter.subject}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {newsletter.templateId || 'Personalizada'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium">
                          <button
                            onClick={() => loadCampaignUsers(newsletter, 'sent', 'Enviados')}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
                          >
                            {newsletter.stats.sent}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            onClick={() => loadCampaignUsers(newsletter, 'opened', 'Abiertos')}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:underline font-medium"
                            disabled={newsletter.stats.opened === 0}
                          >
                            {newsletter.stats.opened}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            onClick={() => loadCampaignUsers(newsletter, 'opened', 'Muy activos', 'very_active')}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:underline font-medium"
                            disabled={!newsletter.stats.veryActiveOpened || newsletter.stats.veryActiveOpened === 0}
                          >
                            {newsletter.stats.veryActiveOpened || 0}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            onClick={() => loadCampaignUsers(newsletter, 'opened', 'Activos', 'active')}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
                            disabled={!newsletter.stats.activeOpened || newsletter.stats.activeOpened === 0}
                          >
                            {newsletter.stats.activeOpened || 0}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`font-semibold ${
                            parseFloat(newsletter.stats.openRate) > 20 ? 'text-green-600 dark:text-green-400' :
                            parseFloat(newsletter.stats.openRate) > 10 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {newsletter.stats.openRate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`font-semibold ${
                            parseFloat(newsletter.stats.clickRate) > 5 ? 'text-green-600 dark:text-green-400' :
                            parseFloat(newsletter.stats.clickRate) > 2 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {newsletter.stats.clickRate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => setSelectedNewsletter(newsletter)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          >
                            Ver newsletter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Ver newsletter */}
        {selectedNewsletter && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedNewsletter.subject}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enviado el {new Date(selectedNewsletter.sentAt).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNewsletter(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Vista previa HTML del email */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Vista previa del email</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-6">
                    {selectedNewsletter.emailContent ? (
                      <div
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedNewsletter.emailContent }}
                      />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No hay vista previa disponible</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Lista de usuarios (Enviados/Abiertos/Clicks) */}
        {showUsersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      👥 {usersModalData.eventType}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {usersModalData.total || 0} usuarios
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUsersModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Métricas de actividad */}
              {usersModalData.metrics && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {usersModalData.metrics.veryActive}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Muy activos (30d)
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {usersModalData.metrics.veryActivePercentage}%
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {usersModalData.metrics.active}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Activos (90d)
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {((usersModalData.metrics.active / usersModalData.total) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {usersModalData.metrics.totalActive}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Total activos
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {usersModalData.metrics.activePercentage}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buscador */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={usersSearchQuery}
                  onChange={(e) => setUsersSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Lista de usuarios */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingUsers_modal ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usersModalData.users
                      .filter(user => {
                        if (!usersSearchQuery) return true
                        const query = usersSearchQuery.toLowerCase()
                        return (
                          user.email?.toLowerCase().includes(query) ||
                          user.fullName?.toLowerCase().includes(query)
                        )
                      })
                      .map((user, index) => {
                        // Calcular tiempo relativo desde última conexión
                        const getRelativeTime = (date) => {
                          if (!date) return 'Nunca'
                          const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
                          if (days === 0) return 'Hoy'
                          if (days === 1) return 'Ayer'
                          if (days < 30) return `Hace ${days}d`
                          const months = Math.floor(days / 30)
                          return `Hace ${months}m`
                        }

                        return (
                          <div
                            key={user.userId || index}
                            className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {user.fullName || 'Sin nombre'}
                                </p>
                                {/* Badge de actividad */}
                                {user.activityLevel === 'very_active' && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                    Muy activo
                                  </span>
                                )}
                                {user.activityLevel === 'active' && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                    Activo
                                  </span>
                                )}
                                {user.activityLevel === 'dormant' && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                                    Inactivo
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              {/* % Aciertos 30d */}
                              <div className="text-center">
                                <div className={`font-bold ${
                                  user.avgScore >= 70 ? 'text-green-600 dark:text-green-400' :
                                  user.avgScore >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                                  user.avgScore > 0 ? 'text-red-600 dark:text-red-400' :
                                  'text-gray-400 dark:text-gray-500'
                                }`}>
                                  {user.avgScore ? user.avgScore.toFixed(0) + '%' : 'Sin completar'}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">Aciertos 30d</div>
                              </div>

                              {/* Antigüedad */}
                              {user.accountAgeDays !== null && (
                                <div className="text-center">
                                  <div className="font-bold text-blue-600 dark:text-blue-400">
                                    {user.accountAgeDays}d
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400">Antigüedad</div>
                                </div>
                              )}

                              {/* Último test */}
                              <div className="text-center">
                                <div className="font-bold text-purple-600 dark:text-purple-400">
                                  {getRelativeTime(user.lastTestDate)}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">Último test</div>
                              </div>

                              {/* Timestamp del evento */}
                              {user.timestamp && (
                                <div className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {new Date(user.timestamp).toLocaleString('es-ES', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {!loadingUsers_modal && usersModalData.users.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      No hay usuarios para mostrar
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* 📧 Progress Modal */}
    {sendingProgress.isActive && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            📧 Enviando Newsletter
          </h3>

          {/* Warning - Do not close */}
          {!sendingProgress.phase.includes('Completado') && !sendingProgress.phase.includes('Error') && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg animate-pulse">
              <p className="text-sm text-red-800 dark:text-red-300 font-bold text-center">
                ⚠️ NO CIERRES ESTA VENTANA
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 text-center mt-1">
                El envío se detendrá si cierras la pestaña
              </p>
            </div>
          )}

          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>{sendingProgress.phase}</span>
              <span>{sendingProgress.sent}/{sendingProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${sendingProgress.total > 0 ? (sendingProgress.sent / sendingProgress.total) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          {/* Estimated time */}
          {!sendingProgress.phase.includes('Completado') && !sendingProgress.phase.includes('Error') && sendingProgress.total > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                ⏳ Tiempo estimado: {Math.ceil(sendingProgress.total * 1.2 / 60)} minutos
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                (Aproximadamente 1 segundo por usuario)
              </p>
            </div>
          )}

          {sendingProgress.current && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-800 dark:text-gray-300 font-medium">
                📤 {sendingProgress.current}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            {sendingProgress.phase.includes('Completado') || sendingProgress.phase.includes('Error') ? (
              <div className="flex items-center space-x-2">
                {sendingProgress.phase.includes('Completado') ? (
                  <>
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                    </div>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {sendingProgress.phase}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                      <span className="text-red-600 dark:text-red-400 text-sm">✗</span>
                    </div>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {sendingProgress.phase}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                    Enviando emails...
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                  Este proceso puede tardar varios minutos.<br/>
                  Por favor, mantén esta ventana abierta.
                </p>
              </div>
            )}
          </div>

          {(sendingProgress.phase.includes('Completado') || sendingProgress.phase.includes('Error')) && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setSendingProgress(prev => ({ ...prev, isActive: false }))}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    )}
      </div>
    </div>
  )
}