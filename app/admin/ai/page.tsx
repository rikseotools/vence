'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '@/contexts/AuthContext'

// ============================================
// TIPOS
// ============================================

interface ProviderConfig {
  provider: string
  is_active: boolean
  has_key: boolean
  api_key_hint: string | null
  default_model: string | null
  last_verification_status: string | null
  last_verified_at: string | null
  last_error_message: string | null
  available_models: { id: string; name: string; description: string; status?: string }[]
}

interface TestResultModel {
  success: boolean
  modelName: string
  modelId: string
  error?: string
  latency?: number
  estimatedCost?: { totalTokens: number; totalCostFormatted: string }
}

interface TestResult {
  success: boolean
  testAllModels?: boolean
  summary?: { working: number; total: number }
  modelResults?: TestResultModel[]
  model?: string
  latency?: number
  response?: string
  usage?: { total_tokens?: number; input_tokens?: number; output_tokens?: number }
  error?: string
}

interface LogUser {
  id?: string
  display_name: string | null
  email: string | null
}

interface LogEntry {
  id: string
  user_id: string | null
  message: string
  response_preview: string | null
  full_response: string | null
  sources_used: string[] | null
  question_context_id: string | null
  question_context_law: string | null
  suggestion_used: string | null
  response_time_ms: number | null
  tokens_used: number | null
  had_error: boolean | null
  error_message: string | null
  feedback: string | null
  feedback_comment: string | null
  detected_laws: string[] | null
  created_at: string | null
  user: LogUser | null
}

interface LogsData {
  success: boolean
  logs: LogEntry[]
  stats: {
    total: number
    positive: number
    negative: number
    noFeedback: number
    errors: number
    avgResponseTime: number
    satisfactionRate: number | null
  }
  topSuggestions: { name: string; count: number }[]
  topLaws: { name: string; count: number }[]
  pagination: { page: number; limit: number; hasMore: boolean }
}

interface UsageStat {
  provider: string
  total_requests: number
  total_tokens: number
  estimated_total_cost_usd: number | null
  total_questions_verified: number
  by_model: Record<string, { requests: number; tokens: number; estimated_cost_usd: number }>
}

interface UsageData {
  success: boolean
  stats: UsageStat[]
}

// Trace types (from ai-traces)
interface TraceTreeNode {
  id: string
  type: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean
  error: string | null
  sequenceNumber: number
  children: TraceTreeNode[]
}

interface TraceDetail {
  id: string
  traceType: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  inputData: Record<string, unknown>
  outputData: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean | null
  errorMessage: string | null
  sequenceNumber: number
  parentTraceId: string | null
}

interface LogTraceDetail {
  log: {
    id: string
    userId: string | null
    message: string
    fullResponse: string | null
    responseTimeMs: number | null
    tokensUsed: number | null
    feedback: string | null
    feedbackComment: string | null
    hadError: boolean | null
    hadDiscrepancy: boolean | null
    aiSuggestedAnswer: string | null
    dbAnswer: string | null
    detectedLaws: unknown[]
    questionContextLaw: string | null
    createdAt: string | null
  }
  traces: TraceDetail[]
  tree: TraceTreeNode[]
  stats: {
    totalDurationMs: number
    llmCallCount: number
    dbQueryCount: number
    errorCount: number
    totalTokensIn: number
    totalTokensOut: number
    dominiosEvaluados: number
    dominioSeleccionado: string | null
  }
}

// ============================================
// UTILIDADES
// ============================================

const getFriendlyErrorMessage = (error: string | null, provider: string): string => {
  const errorLower = (error || '').toLowerCase()
  if (errorLower.includes('quota') || errorLower.includes('rate limit') || errorLower.includes('exceeded'))
    return 'Has superado el limite de uso gratuito. Prueba con otro modelo o espera unos minutos.'
  if (errorLower.includes('invalid') && errorLower.includes('key'))
    return 'La API key no es valida. Verifica que la hayas copiado correctamente.'
  if (errorLower.includes('unauthorized') || errorLower.includes('authentication') || errorLower.includes('401'))
    return 'Error de autenticacion. La API key puede ser incorrecta o haber expirado.'
  if (errorLower.includes('permission') || errorLower.includes('403'))
    return 'No tienes permisos para usar este modelo. Verifica tu plan de suscripcion.'
  if (errorLower.includes('model') && (errorLower.includes('not found') || errorLower.includes('does not exist')))
    return 'El modelo seleccionado no esta disponible. Prueba con otro modelo.'
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econnrefused'))
    return 'Error de conexion. Verifica tu conexion a internet.'
  if (errorLower.includes('billing') || errorLower.includes('payment') || errorLower.includes('insufficient'))
    return 'Problema con la facturacion. Verifica tu metodo de pago en la consola del proveedor.'
  const names: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google AI' }
  return `Error al conectar con ${names[provider] || provider}. Revisa los detalles tecnicos.`
}

const TRACE_TYPE_ICONS: Record<string, string> = {
  routing: '🔀', domain: '📦', llm_call: '🤖', db_query: '🗄️', post_process: '⚙️', error: '❌',
}
const TRACE_TYPE_LABELS: Record<string, string> = {
  routing: 'Routing', domain: 'Dominio', llm_call: 'LLM Call', db_query: 'DB Query', post_process: 'Post-Process', error: 'Error',
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`} />
}

function ProviderLogo({ provider }: { provider: string }) {
  if (provider === 'openai') return <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center"><span className="text-white text-lg font-bold">AI</span></div>
  if (provider === 'anthropic') return <div className="w-10 h-10 bg-[#D4A574] rounded-lg flex items-center justify-center"><span className="text-white text-lg font-bold">A</span></div>
  if (provider === 'google') return <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 rounded-lg flex items-center justify-center"><span className="text-white text-lg font-bold">G</span></div>
  return null
}

// ============================================
// TRACE TREE VIEW
// ============================================

function TraceTreeView({ node, level = 0 }: { node: TraceTreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level === 0)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={`${level > 0 ? 'ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2' : ''}`}>
      <div
        className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
          !node.success ? 'bg-red-50 dark:bg-red-900/20' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        ) : (
          <span className="text-gray-300 w-3"> </span>
        )}
        <span className="text-lg">{TRACE_TYPE_ICONS[node.type] || '📎'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{TRACE_TYPE_LABELS[node.type] || node.type}</span>
            {node.durationMs !== null && <span className="text-xs text-gray-500">{node.durationMs}ms</span>}
            {!node.success && <span className="text-xs text-red-500 font-medium">ERROR</span>}
          </div>
          {expanded && (
            <div className="mt-2 text-xs space-y-2">
              {Object.keys(node.input).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Input:</span>
                  <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.input, null, 2)}
                  </pre>
                </div>
              )}
              {Object.keys(node.output).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Output:</span>
                  <pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.output, null, 2)}
                  </pre>
                </div>
              )}
              {Object.keys(node.metadata).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Metadata:</span>
                  <pre className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {node.error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
                  <span className="font-medium">Error:</span> {node.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child) => (
            <TraceTreeView key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// PROVIDER CARD
// ============================================

function ProviderCard({ config, onUpdate, onTest }: {
  config: ProviderConfig
  onUpdate: (provider: string, updates: Record<string, unknown>) => Promise<void>
  onTest: (provider: string, apiKey: string | null, model: string, testAll: boolean) => Promise<TestResult>
}) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState(config.default_model || '')
  const [isActive, setIsActive] = useState(config.is_active)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const providerNames: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic (Claude)', google: 'Google AI (Gemini)'
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

  const providerLinks: Record<string, { key: string; billing: string; label: string }> = {
    openai: { key: 'https://platform.openai.com/api-keys', billing: 'https://platform.openai.com/usage', label: 'Ver saldo' },
    anthropic: { key: 'https://console.anthropic.com/settings/keys', billing: 'https://console.anthropic.com/settings/billing', label: 'Ver saldo' },
    google: { key: 'https://aistudio.google.com/apikey', billing: 'https://aistudio.google.com/apikey', label: 'Ver limites' },
  }

  const links = providerLinks[config.provider]

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-colors ${
      isActive && config.last_verification_status === 'valid'
        ? 'border-green-300 dark:border-green-700'
        : isActive ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-700'
    }`}>
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
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">✓ Verificada</span>
                )}
                {config.last_verification_status === 'invalid' && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full">✗ Invalida</span>
                )}
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={handleToggleActive} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{isActive ? 'Activo' : 'Inactivo'}</span>
          </label>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.has_key ? '••••••••' + (config.api_key_hint || '') : 'Introduce tu API key'}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          {links && (
            <p className="mt-1 text-xs text-gray-500">
              Obten tu key en <a href={links.key} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{new URL(links.key).hostname}</a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modelo por defecto</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {config.available_models?.map(model => (
              <option key={model.id} value={model.id} disabled={model.status === 'failed'} className={model.status === 'failed' ? 'text-red-500 bg-red-50' : ''}>
                {model.status === 'working' ? '✓ ' : model.status === 'failed' ? '✗ ' : ''}{model.name} - {model.description}{model.status === 'failed' ? ' (no funciona)' : ''}
              </option>
            ))}
          </select>
          {config.available_models?.some(m => m.status === 'failed') && (
            <p className="mt-1 text-xs text-red-500">Los modelos marcados con ✗ no funcionan con tu API key</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={handleSaveKey} disabled={saving || !apiKey} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {saving ? <Spinner size="sm" /> : '💾'}<span>Guardar</span>
          </button>
          <button onClick={() => handleTest(true)} disabled={testing} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {testing ? <Spinner size="sm" /> : '🧪'}<span>Probar modelos</span>
          </button>
          {links && (
            <a href={links.billing} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              💰 <span>{links.label}</span>
            </a>
          )}
        </div>

        {testResult && (
          <div className="space-y-3">
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
                      <span key={i} className={`w-3 h-3 rounded-full ${m.success ? 'bg-green-500' : 'bg-red-500'}`} title={`${m.modelName}: ${m.success ? 'OK' : m.error}`} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {testResult.testAllModels && testResult.modelResults ? (
              <div className="space-y-2">
                {testResult.modelResults.map((modelResult, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${modelResult.success ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{modelResult.success ? '✅' : '❌'}</span>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{modelResult.modelName}</span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">({modelResult.modelId})</span>
                      </div>
                      {modelResult.success && (
                        <div className="flex items-center gap-3 text-xs">
                          {modelResult.latency && <span className="text-gray-500 dark:text-gray-400">{modelResult.latency}ms</span>}
                          {modelResult.estimatedCost && (
                            <>
                              <span className="text-blue-600 dark:text-blue-400">{modelResult.estimatedCost.totalTokens} tok</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">{modelResult.estimatedCost.totalCostFormatted}</span>
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
            ) : testResult.success !== undefined && !testResult.testAllModels && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{testResult.success ? '✅' : '❌'}</span>
                  <span className={`font-medium ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {testResult.success ? 'Conexion exitosa' : 'Error de conexion'}
                  </span>
                </div>
                {testResult.success ? (
                  <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                    <p>Modelo: <span className="font-mono">{testResult.model}</span></p>
                    <p>Latencia: {testResult.latency}ms</p>
                    <p>Respuesta: &quot;{testResult.response}&quot;</p>
                    {testResult.usage && <p>Tokens usados: {testResult.usage.total_tokens || ((testResult.usage.input_tokens || 0) + (testResult.usage.output_tokens || 0))}</p>}
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
                    <p className="font-medium">{getFriendlyErrorMessage(testResult.error || null, config.provider)}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Ver detalles tecnicos</summary>
                      <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{testResult.error}</pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {config.last_verified_at && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span>Ultima verificacion: {new Date(config.last_verified_at).toLocaleString('es-ES')}</span>
            {config.last_error_message && (
              <details className="mt-1">
                <summary className="cursor-pointer text-red-500 hover:text-red-700">{getFriendlyErrorMessage(config.last_error_message, config.provider)}</summary>
                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{config.last_error_message}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// LOG DETAIL MODAL (con traces integrados)
// ============================================

function LogDetailModal({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const { supabase } = useAuth() as { supabase?: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } } }
  const [traceData, setTraceData] = useState<LogTraceDetail | null>(null)
  const [loadingTraces, setLoadingTraces] = useState(false)
  const [showTraces, setShowTraces] = useState(false)

  const fetchTraces = useCallback(async () => {
    if (!supabase || traceData) return
    setLoadingTraces(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/admin/ai-traces/${log.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        setTraceData(await res.json())
      }
    } catch (err) {
      console.error('Error fetching traces:', err)
    } finally {
      setLoadingTraces(false)
    }
  }, [log.id, supabase, traceData])

  const handleShowTraces = () => {
    setShowTraces(true)
    fetchTraces()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {log.user?.display_name || log.user?.email || 'Usuario anonimo'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {log.created_at && new Date(log.created_at).toLocaleString('es-ES')}
                {log.response_time_ms && ` · ${log.response_time_ms}ms`}
                {log.tokens_used && ` · ${log.tokens_used} tokens`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-4 space-y-4">
          {/* Context tags */}
          {(log.suggestion_used || log.question_context_law || (log.detected_laws && log.detected_laws.length > 0)) && (
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100 dark:border-gray-700">
              {log.suggestion_used && (
                <span className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">🎯 {log.suggestion_used}</span>
              )}
              {log.question_context_law && (
                <span className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">📖 Pregunta sobre: {log.question_context_law}</span>
              )}
              {log.detected_laws?.map((law, i) => (
                <span key={i} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">📚 {law}</span>
              ))}
            </div>
          )}

          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
              <p className="text-sm whitespace-pre-wrap">{log.message}</p>
            </div>
          </div>

          {/* Bot response */}
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-tl-sm px-4 py-3">
              {log.had_error ? (
                <div className="text-red-600 dark:text-red-400">
                  <p className="font-medium mb-1">Error al generar respuesta</p>
                  <p className="text-xs text-red-500 dark:text-red-400">{log.error_message}</p>
                </div>
              ) : (
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{log.full_response || log.response_preview || ''}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>

          {/* Sources */}
          {log.sources_used && log.sources_used.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="font-medium mb-1">Fuentes consultadas:</p>
              <ul className="list-disc list-inside">
                {log.sources_used.map((source, i) => <li key={i}>{source}</li>)}
              </ul>
            </div>
          )}

          {/* Traces section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            {!showTraces ? (
              <button
                onClick={handleShowTraces}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                🔍 <span>Ver traces de ejecucion</span>
              </button>
            ) : loadingTraces ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Spinner size="sm" /> Cargando traces...
              </div>
            ) : traceData ? (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Traces de ejecucion</h4>
                {/* Trace stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-center">
                    <div className="text-lg font-bold">{traceData.stats.totalDurationMs}ms</div>
                    <div className="text-xs text-gray-500">Tiempo total</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-center">
                    <div className="text-lg font-bold">{traceData.stats.llmCallCount}</div>
                    <div className="text-xs text-gray-500">Llamadas LLM</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-center">
                    <div className="text-lg font-bold">{traceData.stats.totalTokensIn + traceData.stats.totalTokensOut}</div>
                    <div className="text-xs text-gray-500">Tokens totales</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-center">
                    <div className="text-lg font-bold">{traceData.stats.dominioSeleccionado || '-'}</div>
                    <div className="text-xs text-gray-500">Dominio</div>
                  </div>
                </div>

                {/* Discrepancy */}
                {traceData.log.hadDiscrepancy && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <h5 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm mb-1">Discrepancia Detectada</h5>
                    <div className="text-xs space-y-1">
                      <p><span className="font-medium">AI sugiere:</span> {traceData.log.aiSuggestedAnswer}</p>
                      <p><span className="font-medium">BD dice:</span> {traceData.log.dbAnswer}</p>
                    </div>
                  </div>
                )}

                {/* Trace tree */}
                <div className="border border-gray-200 dark:border-gray-700 rounded p-2">
                  {traceData.tree.length > 0 ? (
                    traceData.tree.map((node) => <TraceTreeView key={node.id} node={node} />)
                  ) : (
                    <p className="text-gray-500 text-sm p-4 text-center">No hay traces para este log</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No se pudieron cargar los traces</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Feedback:</span>
              {log.feedback === 'positive' && <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><span className="text-xl">👍</span><span className="text-sm">Positivo</span></span>}
              {log.feedback === 'negative' && <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><span className="text-xl">👎</span><span className="text-sm">Negativo</span></span>}
              {!log.feedback && <span className="text-sm text-gray-400">Sin feedback</span>}
            </div>
            {log.feedback_comment && (
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">&quot;{log.feedback_comment}&quot;</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAGINA PRINCIPAL
// ============================================

export default function AdminAIPage() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'usage' | 'logs'>('config')
  const [logs, setLogs] = useState<LogsData | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [feedbackFilter, setFeedbackFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  useEffect(() => { loadConfigs() }, [])

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/admin/ai-config')
      const data = await response.json()
      if (data.success) setConfigs(data.configs)
    } catch (err) {
      console.error('Error cargando configuracion:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUsage = async () => {
    setLoadingUsage(true)
    try {
      const response = await fetch('/api/admin/ai-config/usage?days=30')
      const data = await response.json()
      if (data.success) setUsage(data)
    } catch (err) {
      console.error('Error cargando uso:', err)
    } finally {
      setLoadingUsage(false)
    }
  }

  const loadLogs = async (page = 1, filter = feedbackFilter) => {
    setLoadingLogs(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20', feedback: filter })
      const response = await fetch(`/api/admin/ai-chat-logs?${params}`)
      const data = await response.json()
      if (data.success) {
        setLogs(data)
        setLogsPage(page)
      }
    } catch (err) {
      console.error('Error cargando logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleUpdate = async (provider: string, updates: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...updates })
      })
      const data = await response.json()
      if (data.success) loadConfigs()
    } catch (err) {
      console.error('Error actualizando:', err)
    }
  }

  const handleTest = async (provider: string, apiKey: string | null, model: string, testAllModels = true): Promise<TestResult> => {
    try {
      const response = await fetch('/api/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, testAllModels })
      })
      const data = await response.json()
      loadConfigs()
      return data
    } catch (err) {
      console.error('Error probando API:', err)
      return { success: false, error: (err as Error).message }
    }
  }

  useEffect(() => {
    if (activeTab === 'usage' && !usage) loadUsage()
    if (activeTab === 'logs' && !logs) loadLogs()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Spinner size="lg" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-2 inline-block">
            ← Volver al admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🤖 Inteligencia Artificial</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configuracion, uso y logs del sistema de IA</p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
            {([
              { id: 'config' as const, label: '⚙️ Configuracion', color: 'blue' },
              { id: 'usage' as const, label: '📊 Uso y costes', color: 'green' },
              { id: 'logs' as const, label: '💬 Chat Logs', color: 'purple' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? `bg-white dark:bg-gray-700 text-${tab.color}-600 dark:text-${tab.color}-400 border border-b-0 border-gray-200 dark:border-gray-700`
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab: Config */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {configs.map(config => (
              <ProviderCard key={config.provider} config={config} onUpdate={handleUpdate} onTest={handleTest} />
            ))}
          </div>
        )}

        {/* Tab: Usage */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Uso en los ultimos 30 dias</h2>
              <button onClick={loadUsage} disabled={loadingUsage} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1">
                {loadingUsage ? <Spinner size="sm" /> : '🔄'}<span>Actualizar</span>
              </button>
            </div>
            {loadingUsage ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : usage?.stats?.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-5xl mb-4">📭</div>
                <p>No hay datos de uso registrados</p>
                <p className="text-sm mt-1">Los datos apareceran cuando uses las APIs de IA</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {usage?.stats?.map(stat => (
                  <div key={stat.provider} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <ProviderLogo provider={stat.provider} />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {stat.provider === 'openai' ? 'OpenAI' : stat.provider === 'anthropic' ? 'Anthropic' : 'Google AI'}
                        </h3>
                        <p className="text-xs text-gray-500">{stat.total_requests} peticiones</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{(stat.total_tokens / 1000).toFixed(1)}K</div>
                        <div className="text-xs text-gray-500">Tokens totales</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">${stat.estimated_total_cost_usd?.toFixed(4) || '0.00'}</div>
                        <div className="text-xs text-gray-500">Coste estimado</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Por modelo:</h4>
                      {Object.entries(stat.by_model).map(([model, data]) => (
                        <div key={model} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{model}</span>
                          <span className="text-gray-900 dark:text-white">
                            {data.requests} req · {(data.tokens / 1000).toFixed(1)}K tok
                            {data.estimated_cost_usd > 0 && <span className="text-green-600 ml-2">${data.estimated_cost_usd.toFixed(4)}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    {stat.total_questions_verified > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-600 dark:text-gray-400">📝 {stat.total_questions_verified} preguntas verificadas</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Para ver el saldo exacto y limites:</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li><a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="hover:underline">→ OpenAI: platform.openai.com/usage</a></li>
                <li><a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" className="hover:underline">→ Anthropic: console.anthropic.com/settings/billing</a></li>
                <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="hover:underline">→ Google: aistudio.google.com (API gratis con limites)</a></li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Logs del Chat de IA</h2>
              <button onClick={() => loadLogs(1, feedbackFilter)} disabled={loadingLogs} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1">
                {loadingLogs ? <Spinner size="sm" /> : '🔄'}<span>Actualizar</span>
              </button>
            </div>

            {loadingLogs && !logs ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : logs ? (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{logs.stats?.total || 0}</div>
                    <div className="text-xs text-gray-500">Total chats</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{logs.stats?.positive || 0}</div>
                    <div className="text-xs text-gray-500">👍 Positivos</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{logs.stats?.negative || 0}</div>
                    <div className="text-xs text-gray-500">👎 Negativos</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {logs.stats?.satisfactionRate !== null ? `${logs.stats.satisfactionRate}%` : '-'}
                    </div>
                    <div className="text-xs text-gray-500">Satisfaccion</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{logs.stats?.avgResponseTime || 0}ms</div>
                    <div className="text-xs text-gray-500">Tiempo resp.</div>
                  </div>
                </div>

                {/* Top suggestions & laws */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {logs.topSuggestions?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">🎯 Sugerencias mas usadas</h4>
                      <div className="space-y-2">
                        {logs.topSuggestions.map((s, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400 truncate">{s.name}</span>
                            <span className="text-gray-900 dark:text-white font-medium">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {logs.topLaws?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">📚 Leyes mas consultadas</h4>
                      <div className="space-y-2">
                        {logs.topLaws.map((l, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{l.name}</span>
                            <span className="text-gray-900 dark:text-white font-medium">{l.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'positive', 'negative', 'none'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => { setFeedbackFilter(filter); loadLogs(1, filter) }}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        feedbackFilter === filter
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {filter === 'all' && '📋 Todos'}
                      {filter === 'positive' && '👍 Positivos'}
                      {filter === 'negative' && '👎 Negativos'}
                      {filter === 'none' && '❓ Sin feedback'}
                    </button>
                  ))}
                </div>

                {/* Log list */}
                <div className="space-y-3">
                  {logs.logs?.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <div className="text-5xl mb-4">📭</div>
                      <p>No hay logs de chat</p>
                    </div>
                  ) : (
                    logs.logs?.map(log => (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer hover:shadow-md transition-shadow ${
                          log.feedback === 'positive'
                            ? 'border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700'
                            : log.feedback === 'negative'
                              ? 'border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
                              : log.had_error
                                ? 'border-red-300 dark:border-red-700'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span>{log.user?.display_name || log.user?.email || 'Anonimo'}</span>
                              <span>·</span>
                              <span>{log.created_at && new Date(log.created_at).toLocaleString('es-ES')}</span>
                              {log.response_time_ms && (<><span>·</span><span>{log.response_time_ms}ms</span></>)}
                              {log.suggestion_used && (<><span>·</span><span className="text-purple-600 dark:text-purple-400">🎯 {log.suggestion_used}</span></>)}
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">{log.message}</p>
                            {log.response_preview && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{log.response_preview}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {log.question_context_law && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">📖 {log.question_context_law}</span>
                              )}
                              {log.detected_laws?.map((law, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">{law}</span>
                              ))}
                              {log.had_error && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">❌ Error</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {log.feedback === 'positive' && <span className="text-2xl">👍</span>}
                            {log.feedback === 'negative' && <span className="text-2xl">👎</span>}
                            {!log.feedback && !log.had_error && <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {logs.logs?.length > 0 && (
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => loadLogs(logsPage - 1, feedbackFilter)}
                      disabled={logsPage === 1 || loadingLogs}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      ← Anterior
                    </button>
                    <span className="px-4 py-2 text-gray-600 dark:text-gray-400">Pagina {logsPage}</span>
                    <button
                      onClick={() => loadLogs(logsPage + 1, feedbackFilter)}
                      disabled={!logs.pagination?.hasMore || loadingLogs}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400"><p>Error cargando logs</p></div>
            )}
          </div>
        )}
      </div>

      {/* Log detail modal with traces */}
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  )
}
