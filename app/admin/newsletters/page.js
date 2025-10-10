// app/admin/newsletters/page.js - Panel de newsletters
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function NewslettersPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [audienceStats, setAudienceStats] = useState(null)
  const [result, setResult] = useState(null)
  
  // Form state
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [selectedAudiences, setSelectedAudiences] = useState(['all'])
  const [testMode, setTestMode] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  // Email statistics state
  const [templateStats, setTemplateStats] = useState({})
  const [loadingStats, setLoadingStats] = useState(false)
  
  // User selection state
  const [selectionMode, setSelectionMode] = useState('audience') // 'audience' | 'individual'
  const [users, setUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPagination, setUserPagination] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Template management state
  const [savedTemplates, setSavedTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [editingTemplateName, setEditingTemplateName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loadedCustomTemplate, setLoadedCustomTemplate] = useState(null)

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

  const getTotalRecipients = () => {
    if (selectionMode === 'individual') {
      return selectedUsers.size
    }
    if (!audienceStats) return 0
    return selectedAudiences.reduce((total, audience) => {
      return total + (audienceStats[audience] || 0)
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
    
    
    try {
      if (selectionMode === 'individual') {
        // Envío a usuarios específicos
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
        setResult({
          ...data,
          audienceType: 'usuarios seleccionados',
          audiences: [{ audienceName: 'Usuarios seleccionados', ...data }]
        })
      } else {
        // Enviar a cada audiencia por separado
        const results = []
        
        for (const audienceType of selectedAudiences) {
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
      setResult({
        success: false,
        error: 'Error de conexión'
      })
    }
    setLoading(false)
  }

  const audienceOptions = [
    { value: 'all', label: 'Todos los usuarios', description: 'Todos los usuarios registrados' },
    { value: 'active', label: 'Usuarios activos', description: 'Usuarios con actividad reciente' },
    { value: 'inactive', label: 'Usuarios inactivos', description: 'Usuarios sin actividad reciente' },
    { value: 'premium', label: 'Usuarios premium', description: 'Usuarios con suscripción activa' },
    { value: 'free', label: 'Usuarios gratuitos', description: 'Usuarios sin suscripción' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📧 Sistema de Newsletters
          </h1>
          <p className="text-gray-600">
            Envía comunicaciones masivas a tus usuarios con control total
          </p>
        </div>

        {/* Stats Cards */}
        {audienceStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {audienceOptions.map(option => (
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
                      onChange={(e) => setSelectionMode(e.target.value)}
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
                      onChange={(e) => setSelectionMode(e.target.value)}
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
                  <div className="space-y-3 p-4 border border-gray-300 rounded-lg bg-gray-50">
                    {audienceOptions.map(option => (
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
                
                <p className="text-sm text-gray-500 mt-1">
                  💡 Tip: Usa {'{user_name}'} para personalizar con el nombre del usuario
                </p>
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
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}