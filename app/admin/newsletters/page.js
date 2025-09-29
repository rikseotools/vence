// app/admin/newsletters/page.js - Panel de newsletters
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function NewslettersPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [audienceStats, setAudienceStats] = useState(null)
  const [result, setResult] = useState(null)
  
  // Form state
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [selectedAudiences, setSelectedAudiences] = useState(['all'])
  const [testMode, setTestMode] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  
  // User selection state
  const [selectionMode, setSelectionMode] = useState('audience') // 'audience' | 'individual'
  const [users, setUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPagination, setUserPagination] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Cargar estadísticas de audiencia al montar
  useEffect(() => {
    loadAudienceStats()
  }, [])

  // Cargar usuarios cuando cambie el modo o la búsqueda
  useEffect(() => {
    if (selectionMode === 'individual') {
      loadUsers()
    }
  }, [selectionMode, userSearch, userPage])

  // Cargar usuarios individuales cuando se seleccione una audiencia
  useEffect(() => {
    if (selectionMode === 'individual' && selectedAudiences.length === 1) {
      loadUsers()
    }
  }, [selectedAudiences, selectionMode])

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
        console.error('Error cargando usuarios:', data.error)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
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
      confirmMessage = testMode 
        ? `¿Enviar newsletter de PRUEBA a máximo 3 usuarios seleccionados?\n\nTotal: ${totalRecipients} usuarios`
        : `¿Enviar newsletter a ${totalRecipients} usuarios seleccionados?`
    } else {
      const audienceNames = selectedAudiences.map(aud => 
        audienceOptions.find(opt => opt.value === aud)?.label
      ).join(', ')
      confirmMessage = testMode 
        ? `¿Enviar newsletter de PRUEBA a máximo 3 usuarios por audiencia?\n\nAudiencias: ${audienceNames}`
        : `¿Enviar newsletter a ${totalRecipients.toLocaleString()} usuarios?\n\nAudiencias: ${audienceNames}`
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
            testMode
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
              testMode
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
          setSubject('')
          setHtmlContent('')
          setSelectedAudiences(['all'])
        }
      }

      // Limpiar formulario para modo individual
      if (selectionMode === 'individual' && result?.success && !testMode) {
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
              
              {/* Test Mode Toggle */}
              <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="mr-3"
                  />
                  <span className="font-medium text-yellow-800">
                    🧪 Modo prueba (máximo 3 emails)
                  </span>
                </label>
                <p className="text-sm text-yellow-700 mt-1">
                  Recomendado: prueba siempre antes del envío real
                </p>
              </div>

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
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {showPreview ? '📝 Editar' : '👁️ Preview'}
                  </button>
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
                    : testMode
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? (
                  '⏳ Enviando...'
                ) : testMode ? (
                  '🧪 Enviar Prueba'
                ) : (
                  `📧 Enviar a ${getTotalRecipients().toLocaleString()} usuarios`
                )}
              </button>
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
                    {result.testMode && (
                      <div className="text-sm text-yellow-600 font-medium">
                        🧪 Modo prueba activo
                      </div>
                    )}
                    
                    {result.errors?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-red-600 mb-2">Errores:</h4>
                        <div className="text-xs space-y-1">
                          {result.errors.map((error, i) => (
                            <div key={i} className="text-red-600">
                              {error.email}: {error.error}
                            </div>
                          ))}
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

            {/* Quick Templates */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">📝 Templates Rápidos</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSubject('🚀 ILoveTest es ahora Vence - ¡Misma calidad, nueva marca!')
                    setHtmlContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ILoveTest es ahora Vence</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #667eea;">🚀 ¡Hola {user_name}!</h1>
    <h2 style="color: #1e3a8a; text-align: center; margin: 30px 0 20px 0;">ILoveTest es ahora <strong>Vence</strong></h2>
    
    <p>Te escribimos para comunicarte un cambio importante: <strong>ILoveTest ahora se llama Vence</strong>.</p>
    
    <h3 style="color: #1e3a8a;">¿Qué cambia para ti?</h3>
    <ul>
      <li>✅ <strong>Nada</strong> - El mismo equipo de siempre</li>
      <li>✅ <strong>Nada</strong> - La misma calidad en contenidos</li>
      <li>✅ <strong>Nada</strong> - Las mismas funcionalidades</li>
      <li>✅ <strong>Nada</strong> - Tu progreso se mantiene intacto</li>
    </ul>
    
    <p>Solo cambia nuestro nombre: una marca más <strong>corta</strong>, <strong>moderna</strong> y <strong>fácil de recordar</strong>.</p>
    
    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #1e40af;"><strong>📅 ¡Tenemos novedades!</strong><br>
      La próxima semana lanzamos nuevas funcionalidades que te van a encantar. Estate atento a tu email.</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404;"><strong>💡 Ayúdanos a mejorar</strong><br>
      Entra en <strong>vence.es</strong>, logéate y haznos alguna sugerencia. Trataremos de implementarla para hacer Vence aún mejor para ti.</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://vence.es" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">🎯 Visitar Vence</a>
    </div>
    <p>Gracias por acompañarnos en esta evolución.</p>
    <p>El equipo de Vence</p>
  </div>
</body>
</html>`)
                  }}
                  className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded border"
                >
                  🚀 Rebranding ILoveTest → Vence
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}