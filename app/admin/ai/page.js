'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const Spinner = ({ size = 'sm' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`} />
  )
}

// Función para traducir errores técnicos a mensajes amigables
const getFriendlyErrorMessage = (error, provider) => {
  const errorLower = (error || '').toLowerCase()

  // Errores de cuota/límites
  if (errorLower.includes('quota') || errorLower.includes('rate limit') || errorLower.includes('exceeded')) {
    return `Has superado el límite de uso gratuito. Prueba con otro modelo o espera unos minutos.`
  }

  // Errores de autenticación
  if (errorLower.includes('invalid') && errorLower.includes('key')) {
    return `La API key no es válida. Verifica que la hayas copiado correctamente.`
  }
  if (errorLower.includes('unauthorized') || errorLower.includes('authentication') || errorLower.includes('401')) {
    return `Error de autenticación. La API key puede ser incorrecta o haber expirado.`
  }
  if (errorLower.includes('permission') || errorLower.includes('403')) {
    return `No tienes permisos para usar este modelo. Verifica tu plan de suscripción.`
  }

  // Errores de modelo
  if (errorLower.includes('model') && (errorLower.includes('not found') || errorLower.includes('does not exist'))) {
    return `El modelo seleccionado no está disponible. Prueba con otro modelo.`
  }

  // Errores de red
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econnrefused')) {
    return `Error de conexión. Verifica tu conexión a internet.`
  }

  // Errores de saldo
  if (errorLower.includes('billing') || errorLower.includes('payment') || errorLower.includes('insufficient')) {
    return `Problema con la facturación. Verifica tu método de pago en la consola del proveedor.`
  }

  // Error genérico
  return `Error al conectar con ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google AI'}. Revisa los detalles técnicos.`
}

const ProviderLogo = ({ provider }) => {
  if (provider === 'openai') {
    return (
      <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
        <span className="text-white text-lg font-bold">AI</span>
      </div>
    )
  }
  if (provider === 'anthropic') {
    return (
      <div className="w-10 h-10 bg-[#D4A574] rounded-lg flex items-center justify-center">
        <span className="text-white text-lg font-bold">A</span>
      </div>
    )
  }
  if (provider === 'google') {
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 rounded-lg flex items-center justify-center">
        <span className="text-white text-lg font-bold">G</span>
      </div>
    )
  }
  return null
}

const ProviderCard = ({ config, onUpdate, onTest }) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState(config.default_model || '')
  const [isActive, setIsActive] = useState(config.is_active)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const providerNames = {
    openai: 'OpenAI',
    anthropic: 'Anthropic (Claude)',
    google: 'Google AI (Gemini)'
  }

  const handleSaveKey = async () => {
    setSaving(true)
    try {
      await onUpdate(config.provider, { apiKey, defaultModel: selectedModel, isActive })
      setApiKey('')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (testAll = true) => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(config.provider, apiKey || null, selectedModel, testAll)
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const handleToggleActive = async () => {
    const newActive = !isActive
    setIsActive(newActive)
    await onUpdate(config.provider, { isActive: newActive })
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-colors ${
      isActive && config.last_verification_status === 'valid'
        ? 'border-green-300 dark:border-green-700'
        : isActive
          ? 'border-blue-300 dark:border-blue-700'
          : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ProviderLogo provider={config.provider} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {providerNames[config.provider] || config.provider}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {config.has_key ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">
                    Key configurada ({config.api_key_hint})
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full">
                    Sin API key
                  </span>
                )}
                {config.last_verification_status === 'valid' && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">
                    ✓ Verificada
                  </span>
                )}
                {config.last_verification_status === 'invalid' && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full">
                    ✗ Inválida
                  </span>
                )}
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={handleToggleActive}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </label>
        </div>
      </div>

      {/* Config */}
      <div className="p-6 space-y-4">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.has_key ? '••••••••' + (config.api_key_hint || '') : 'Introduce tu API key'}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          {config.provider === 'openai' && (
            <p className="mt-1 text-xs text-gray-500">
              Obtén tu key en <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a>
            </p>
          )}
          {config.provider === 'anthropic' && (
            <p className="mt-1 text-xs text-gray-500">
              Obtén tu key en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a>
            </p>
          )}
          {config.provider === 'google' && (
            <p className="mt-1 text-xs text-gray-500">
              Obtén tu key en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aistudio.google.com</a>
            </p>
          )}
        </div>

        {/* Modelo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Modelo por defecto
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {config.available_models?.map(model => (
              <option
                key={model.id}
                value={model.id}
                disabled={model.status === 'failed'}
                className={model.status === 'failed' ? 'text-red-500 bg-red-50' : ''}
              >
                {model.status === 'working' ? '✓ ' : model.status === 'failed' ? '✗ ' : ''}
                {model.name} - {model.description}
                {model.status === 'failed' ? ' (no funciona)' : ''}
              </option>
            ))}
          </select>
          {config.available_models?.some(m => m.status === 'failed') && (
            <p className="mt-1 text-xs text-red-500">
              Los modelos marcados con ✗ no funcionan con tu API key
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleSaveKey}
            disabled={saving || !apiKey}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving ? <Spinner size="sm" /> : '💾'}
            <span>Guardar</span>
          </button>
          <button
            onClick={() => handleTest(true)}
            disabled={testing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {testing ? <Spinner size="sm" /> : '🧪'}
            <span>Probar modelos</span>
          </button>
          {config.provider === 'openai' && (
            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              💰 <span>Ver saldo</span>
            </a>
          )}
          {config.provider === 'anthropic' && (
            <a
              href="https://console.anthropic.com/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              💰 <span>Ver saldo</span>
            </a>
          )}
          {config.provider === 'google' && (
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              📊 <span>Ver límites</span>
            </a>
          )}
        </div>

        {/* Resultado del test */}
        {testResult && (
          <div className="space-y-3">
            {/* Resumen si es test de todos los modelos */}
            {testResult.testAllModels && testResult.summary && (
              <div className={`p-3 rounded-lg ${
                testResult.summary.working === testResult.summary.total
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : testResult.summary.working > 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Modelos: {testResult.summary.working}/{testResult.summary.total} funcionando
                  </span>
                  <div className="flex gap-1">
                    {testResult.modelResults?.map((m, i) => (
                      <span
                        key={i}
                        className={`w-3 h-3 rounded-full ${m.success ? 'bg-green-500' : 'bg-red-500'}`}
                        title={`${m.modelName}: ${m.success ? 'OK' : m.error}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Resultados por modelo */}
            {testResult.testAllModels && testResult.modelResults ? (
              <div className="space-y-2">
                {testResult.modelResults.map((modelResult, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      modelResult.success
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{modelResult.success ? '✅' : '❌'}</span>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {modelResult.modelName}
                        </span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          ({modelResult.modelId})
                        </span>
                      </div>
                      {modelResult.success && (
                        <div className="flex items-center gap-3 text-xs">
                          {modelResult.latency && (
                            <span className="text-gray-500 dark:text-gray-400">
                              {modelResult.latency}ms
                            </span>
                          )}
                          {modelResult.estimatedCost && (
                            <>
                              <span className="text-blue-600 dark:text-blue-400">
                                {modelResult.estimatedCost.totalTokens} tok
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {modelResult.estimatedCost.totalCostFormatted}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {!modelResult.success && modelResult.error && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:text-red-700">
                          {getFriendlyErrorMessage(modelResult.error, config.provider)}
                        </summary>
                        <pre className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all text-red-700 dark:text-red-300">
                          {modelResult.error}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Resultado de test individual */
              <div className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{testResult.success ? '✅' : '❌'}</span>
                  <span className={`font-medium ${
                    testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {testResult.success ? 'Conexión exitosa' : 'Error de conexión'}
                  </span>
                </div>
                {testResult.success ? (
                  <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                    <p>Modelo: <span className="font-mono">{testResult.model}</span></p>
                    <p>Latencia: {testResult.latency}ms</p>
                    <p>Respuesta: "{testResult.response}"</p>
                    {testResult.usage && (
                      <p>Tokens usados: {testResult.usage.total_tokens || (testResult.usage.input_tokens + testResult.usage.output_tokens)}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
                    <p className="font-medium">
                      {getFriendlyErrorMessage(testResult.error, config.provider)}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                        Ver detalles técnicos
                      </summary>
                      <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                        {testResult.error}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Última verificación */}
        {config.last_verified_at && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span>Última verificación: {new Date(config.last_verified_at).toLocaleString('es-ES')}</span>
            {config.last_error_message && (
              <details className="mt-1">
                <summary className="cursor-pointer text-red-500 hover:text-red-700">
                  {getFriendlyErrorMessage(config.last_error_message, config.provider)}
                </summary>
                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {config.last_error_message}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminAIPage() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [activeTab, setActiveTab] = useState('config') // 'config' | 'usage'

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/admin/ai-config')
      const data = await response.json()
      if (data.success) {
        setConfigs(data.configs)
      }
    } catch (err) {
      console.error('Error cargando configuración:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUsage = async () => {
    setLoadingUsage(true)
    try {
      const response = await fetch('/api/admin/ai-config/usage?days=30')
      const data = await response.json()
      if (data.success) {
        setUsage(data)
      }
    } catch (err) {
      console.error('Error cargando uso:', err)
    } finally {
      setLoadingUsage(false)
    }
  }

  const handleUpdate = async (provider, updates) => {
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...updates })
      })
      const data = await response.json()
      if (data.success) {
        loadConfigs()
      }
    } catch (err) {
      console.error('Error actualizando:', err)
    }
  }

  const handleTest = async (provider, apiKey, model, testAllModels = true) => {
    try {
      const response = await fetch('/api/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, testAllModels })
      })
      const data = await response.json()
      loadConfigs() // Recargar para actualizar el estado de verificación
      return data
    } catch (err) {
      console.error('Error probando API:', err)
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    if (activeTab === 'usage' && !usage) {
      loadUsage()
    }
  }, [activeTab])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-2 inline-block"
          >
            ← Volver al admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🤖 Configuración de IA
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestiona las API keys y modelos de inteligencia artificial
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'config'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              ⚙️ Configuración
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'usage'
                  ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 border border-b-0 border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              📊 Uso y costes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab: Configuración */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {configs.map(config => (
              <ProviderCard
                key={config.provider}
                config={config}
                onUpdate={handleUpdate}
                onTest={handleTest}
              />
            ))}
          </div>
        )}

        {/* Tab: Uso */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Uso en los últimos 30 días
              </h2>
              <button
                onClick={loadUsage}
                disabled={loadingUsage}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                {loadingUsage ? <Spinner size="sm" /> : '🔄'}
                <span>Actualizar</span>
              </button>
            </div>

            {loadingUsage ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : usage?.stats?.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-5xl mb-4">📭</div>
                <p>No hay datos de uso registrados</p>
                <p className="text-sm mt-1">Los datos aparecerán cuando uses las APIs de IA</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {usage?.stats?.map(stat => (
                  <div
                    key={stat.provider}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <ProviderLogo provider={stat.provider} />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {stat.provider === 'openai' ? 'OpenAI' : stat.provider === 'anthropic' ? 'Anthropic' : 'Google AI'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {stat.total_requests} peticiones
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(stat.total_tokens / 1000).toFixed(1)}K
                        </div>
                        <div className="text-xs text-gray-500">Tokens totales</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${stat.estimated_total_cost_usd?.toFixed(4) || '0.00'}
                        </div>
                        <div className="text-xs text-gray-500">Coste estimado</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Por modelo:
                      </h4>
                      {Object.entries(stat.by_model).map(([model, data]) => (
                        <div key={model} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                            {model}
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {data.requests} req · {(data.tokens / 1000).toFixed(1)}K tok
                            {data.estimated_cost_usd > 0 && (
                              <span className="text-green-600 ml-2">
                                ${data.estimated_cost_usd.toFixed(4)}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {stat.total_questions_verified > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          📝 {stat.total_questions_verified} preguntas verificadas
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Links externos */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                💡 Para ver el saldo exacto y límites:
              </h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>
                  <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    → OpenAI: platform.openai.com/usage
                  </a>
                </li>
                <li>
                  <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    → Anthropic: console.anthropic.com/settings/billing
                  </a>
                </li>
                <li>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    → Google: aistudio.google.com (API gratis con límites)
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
