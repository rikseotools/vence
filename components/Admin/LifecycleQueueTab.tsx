'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface AiModel {
  id: string
  name?: string
  status: string
}

interface AiConfig {
  provider: string
  is_active: boolean
  api_key_encrypted?: string
  has_key?: boolean
  available_models?: AiModel[]
}

const QUEUE_STATES = [
  { state: 'needs_review', emoji: '🟡', label: 'Necesita arreglo (con fix IA)', color: 'yellow' },
  { state: 'needs_human', emoji: '🟠', label: 'Requiere decisión humana', color: 'orange' },
  { state: 'quarantine', emoji: '🟣', label: 'Estructural roto', color: 'purple' },
  { state: 'draft', emoji: '⏳', label: 'Sin verificar', color: 'gray' },
  { state: 'retired_irreparable', emoji: '⛔', label: 'Jubilada (irrecuperable)', color: 'red' },
  { state: 'retired_duplicate', emoji: '🗑️', label: 'Jubilada (duplicada)', color: 'gray' },
] as const

type QueueState = (typeof QUEUE_STATES)[number]['state']

interface AiVerification {
  ai_provider: string
  ai_model: string | null
  confidence: string | null
  explanation: string | null
  article_ok: boolean | null
  answer_ok: boolean | null
  explanation_ok: boolean | null
  correct_article_suggestion: string | null
  correct_option_should_be: string | null
  explanation_fix: string | null
  verified_at: string
}

interface QueueQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string | null
  correct_option: number
  explanation: string
  primary_article_id: string
  lifecycle_state: string
  topic_review_status: string | null
  created_at: string
  article_number: string | null
  article_title: string | null
  law_short_name: string | null
  ai_verification: AiVerification | null
}

const LETTER = ['A', 'B', 'C', 'D', 'E']

export default function LifecycleQueueTab() {
  const [state, setState] = useState<QueueState>('needs_review')
  const [questions, setQuestions] = useState<QueueQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ applied: number; skipped: number; failed: number; details?: string } | null>(null)

  // IA selectors (compartidos con TopicReviewTab vía localStorage)
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [verifyRunning, setVerifyRunning] = useState(false)
  const [verifyProgress, setVerifyProgress] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const results = await Promise.all(
        QUEUE_STATES.map(s =>
          adminFetch(`/api/admin/lifecycle/queue?state=${s.state}&limit=1`, { headers })
            .then(r => r.json())
            .then(d => [s.state, d.total ?? 0])
            .catch(() => [s.state, 0])
        )
      )
      setCounts(Object.fromEntries(results))
    } catch (e) {
      console.warn('Error cargando counts', e)
    }
  }, [])

  const loadQueue = useCallback(async (newState: QueueState) => {
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())  // reset selección al cambiar de cola
    setBulkResult(null)
    try {
      const headers = await getAuthHeaders()
      const r = await adminFetch(`/api/admin/lifecycle/queue?state=${newState}&limit=50`, { headers })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error desconocido')
      setQuestions(d.questions)
      setTotal(d.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelectedIds(new Set(questions.map(q => q.id)))
  const deselectAll = () => setSelectedIds(new Set())

  // Para each tipo de fix, cuántas seleccionadas son aplicables?
  const selectedQuestions = questions.filter(q => selectedIds.has(q.id))
  const selectedWithExplFix = selectedQuestions.filter(
    q => q.ai_verification?.explanation_fix && q.ai_verification.explanation_fix.trim().length > 0
  ).length
  const selectedWithOptFix = selectedQuestions.filter(
    q => q.ai_verification?.correct_option_should_be
  ).length
  const selectedWithBoth = selectedQuestions.filter(
    q =>
      q.ai_verification?.explanation_fix &&
      q.ai_verification.explanation_fix.trim().length > 0 &&
      q.ai_verification?.correct_option_should_be
  ).length

  const runBulkApply = async (applyExplanation: boolean, applyCorrectOption: boolean) => {
    if (selectedIds.size === 0) return
    setBulkRunning(true)
    setError(null)
    setBulkResult(null)
    try {
      const headers = await getAuthHeaders()
      const r = await adminFetch('/api/admin/lifecycle/apply-fix-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          questionIds: Array.from(selectedIds),
          applyExplanation,
          applyCorrectOption,
          newState: 'auto',
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error bulk apply')
      // Quitar las aplicadas con éxito de la lista local
      const appliedIds = new Set<string>(d.applied.map((x: { questionId: string }) => x.questionId))
      setQuestions(prev => prev.filter(q => !appliedIds.has(q.id)))
      setTotal(t => Math.max(0, t - appliedIds.size))
      setSelectedIds(prev => {
        const next = new Set(prev)
        appliedIds.forEach(id => next.delete(id))
        return next
      })
      // Resumen para mostrar al usuario
      const detailParts: string[] = []
      if (d.skipped.length > 0) {
        const reasonCounts = new Map<string, number>()
        for (const s of d.skipped as Array<{ reason: string }>) {
          reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1)
        }
        detailParts.push('Razones de skipped: ' + Array.from(reasonCounts.entries()).map(([r, n]) => `${n}× ${r}`).join('; '))
      }
      if (d.failed.length > 0) {
        detailParts.push(`Fallidas (primeras 3): ${d.failed.slice(0, 3).map((f: { questionId: string; error: string }) => `${f.questionId.substring(0, 8)}: ${f.error}`).join('; ')}`)
      }
      setBulkResult({
        applied: d.summary.applied,
        skipped: d.summary.skipped,
        failed: d.summary.failed,
        details: detailParts.join(' · ') || undefined,
      })
      loadCounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkRunning(false)
    }
  }

  // Cargar AI configs (mismo patrón que TopicReviewTab, comparte localStorage keys)
  const loadAiConfig = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const r = await adminFetch('/api/admin/ai-config', { headers })
      const d = await r.json()
      if (!d.success || !d.configs) return
      const active: AiConfig[] = d.configs.filter(
        (c: AiConfig) =>
          c.is_active &&
          (c.api_key_encrypted || c.has_key) &&
          c.available_models?.some(m => m.status === 'working')
      )
      setAiConfigs(active)
      const savedProvider = localStorage.getItem('topic_review_ai_provider')
      const savedModel = localStorage.getItem('topic_review_ai_model')
      if (savedProvider && active.find(c => c.provider === savedProvider)) {
        setSelectedProvider(savedProvider)
        const cfg = active.find(c => c.provider === savedProvider)
        const models = cfg?.available_models?.filter(m => m.status === 'working') ?? []
        if (savedModel && models.find(m => m.id === savedModel)) setSelectedModel(savedModel)
        else if (models.length > 0) setSelectedModel(models[0].id)
      } else if (active.length > 0) {
        setSelectedProvider(active[0].provider)
        const m = active[0].available_models?.find(x => x.status === 'working')
        if (m) setSelectedModel(m.id)
      }
    } catch (e) {
      console.warn('Error cargando AI config:', e)
    }
  }, [])

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    localStorage.setItem('topic_review_ai_provider', provider)
    const cfg = aiConfigs.find(c => c.provider === provider)
    const m = cfg?.available_models?.find(x => x.status === 'working')
    if (m) {
      setSelectedModel(m.id)
      localStorage.setItem('topic_review_ai_model', m.id)
    }
  }

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    localStorage.setItem('topic_review_ai_model', model)
  }

  const availableModels = (): AiModel[] => {
    const cfg = aiConfigs.find(c => c.provider === selectedProvider)
    return cfg?.available_models?.filter(m => m.status === 'working') ?? []
  }

  // Bulk verify IA: usa el endpoint /api/topic-review/verify (que ya transiciona lifecycle)
  const runBulkVerify = async () => {
    if (selectedIds.size === 0) return
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona proveedor IA y modelo antes de verificar')
      return
    }
    setVerifyRunning(true)
    setError(null)
    setBulkResult(null)
    setVerifyProgress(`Lanzando verificación de ${selectedIds.size} preguntas con ${selectedProvider}/${selectedModel}…`)
    try {
      const headers = await getAuthHeaders()
      const r = await fetch('/api/topic-review/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          questionIds: Array.from(selectedIds),
          provider: selectedProvider,
          model: selectedModel,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setVerifyProgress(null)
      // Las preguntas verificadas habrán transicionado fuera de draft → recargar cola
      setBulkResult({
        applied: d.results?.length ?? 0,
        skipped: 0,
        failed: d.errors?.length ?? 0,
        details: d.errors?.length > 0 ? `Primeros errores: ${d.errors.slice(0, 3).map((e: { error: string }) => e.error).join('; ')}` : undefined,
      })
      setSelectedIds(new Set())
      loadQueue(state)  // recarga la cola actual
      loadCounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setVerifyProgress(null)
    } finally {
      setVerifyRunning(false)
    }
  }

  useEffect(() => {
    loadAiConfig()
  }, [loadAiConfig])

  useEffect(() => {
    loadCounts()
    loadQueue(state)
  }, [loadCounts, loadQueue, state])

  const applyFix = async (
    questionId: string,
    applyExplanation: boolean,
    applyCorrectOption: boolean,
    isVirtualLaw: boolean
  ) => {
    setApplying(questionId)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const r = await adminFetch('/api/admin/lifecycle/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          questionId,
          applyExplanation,
          applyCorrectOption,
          newState: isVirtualLaw ? 'tech_approved' : 'approved',
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error apply-fix')
      // Quitar de la lista local + refresh counts
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      setTotal(t => Math.max(0, t - 1))
      loadCounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(null)
    }
  }

  const markAsState = async (
    questionId: string,
    fromState: string,
    newState: 'approved' | 'tech_approved' | 'needs_human' | 'retired_irreparable' | 'retired_duplicate'
  ) => {
    setApplying(questionId)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const r = await adminFetch('/api/admin/questions/lifecycle/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          questionId,
          expectedState: fromState,
          newState,
          reasonCode: newState === 'approved' || newState === 'tech_approved'
            ? 'admin_marked_perfect'
            : 'admin_marked_problem',
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error transición')
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      setTotal(t => Math.max(0, t - 1))
      loadCounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Cola de revisión por tipo de problema
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Vista alternativa a "Por tema": agrupa preguntas por <code>lifecycle_state</code> en lugar
          de por tema. Útil para vaciar colas de problemas concretos en bloque (ej. aplicar fixes IA a las
          {' '}<code>needs_review</code>, o verificar IA en lote sobre <code>draft</code>).
        </p>
      </div>

      {/* AI provider/model selectors — compartidos con TopicReviewTab vía localStorage */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor IA</label>
          <select
            value={selectedProvider}
            onChange={e => handleProviderChange(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded text-sm"
            disabled={aiConfigs.length === 0}
          >
            {aiConfigs.length === 0 && <option>—</option>}
            {aiConfigs.map(c => (
              <option key={c.provider} value={c.provider}>{c.provider}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
          <select
            value={selectedModel}
            onChange={e => handleModelChange(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded text-sm min-w-[200px]"
            disabled={availableModels().length === 0}
          >
            {availableModels().length === 0 && <option>—</option>}
            {availableModels().map(m => (
              <option key={m.id} value={m.id}>{m.name || m.id}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
          Selección compartida con la pestaña "Por tema". Se usa para "Verificar IA" en cola <code>draft</code>.
        </div>
      </div>

      {/* Selector de cola */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {QUEUE_STATES.map(s => (
          <button
            key={s.state}
            onClick={() => setState(s.state)}
            className={`p-3 rounded-lg border-2 text-left transition ${
              state === s.state
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="text-2xl">{s.emoji}</div>
            <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-tight">{s.label}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
              {counts[s.state] ?? '—'}
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Mostrando {questions.length} de {total} en <code>{state}</code> (top 50 más recientes)
      </div>

      {/* Barra bulk — aparece para todas las colas reparables */}
      {(state === 'needs_review' || state === 'needs_human' || state === 'quarantine' || state === 'draft') && questions.length > 0 && (
        <div className="sticky top-0 z-10 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-wrap items-center gap-2">
          <button
            onClick={selectedIds.size === questions.length ? deselectAll : selectAllVisible}
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {selectedIds.size === questions.length ? 'Deseleccionar todo' : 'Seleccionar todas las visibles'}
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            <strong>{selectedIds.size}</strong> seleccionadas
          </span>
          {selectedIds.size > 0 && (
            <>
              {/* Apply fix solo tiene sentido en colas con AI verification existente */}
              {(state === 'needs_review' || state === 'needs_human' || state === 'quarantine') && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  · {selectedWithBoth} con ambos fixes · {selectedWithExplFix} con expl · {selectedWithOptFix} con resp
                </span>
              )}
              <div className="flex-grow" />

              {/* Botón verificar IA: para draft (primera vez) o cualquier cola si quieres re-verificar */}
              <button
                onClick={runBulkVerify}
                disabled={verifyRunning || bulkRunning || !selectedProvider || !selectedModel}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm rounded font-medium"
                title={`Lanza verificación IA (${selectedProvider}/${selectedModel}) sobre las ${selectedIds.size} seleccionadas`}
              >
                {verifyRunning ? '⏳ Verificando…' : `🤖 Verificar IA (${selectedIds.size})`}
              </button>

              {(state === 'needs_review' || state === 'needs_human' || state === 'quarantine') && (
                <>
                  <button
                    onClick={() => runBulkApply(true, true)}
                    disabled={bulkRunning || verifyRunning || selectedWithBoth === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded font-medium"
                    title={`Aplica explanation_fix + correct_option a las ${selectedWithBoth} con ambos`}
                  >
                    {bulkRunning ? '…' : `Apply ambos (${selectedWithBoth})`}
                  </button>
                  <button
                    onClick={() => runBulkApply(true, false)}
                    disabled={bulkRunning || verifyRunning || selectedWithExplFix === 0}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm rounded"
                    title={`Aplica explanation_fix a las ${selectedWithExplFix} aplicables; salta el resto`}
                  >
                    {bulkRunning ? '…' : `Apply solo expl (${selectedWithExplFix})`}
                  </button>
                  <button
                    onClick={() => runBulkApply(false, true)}
                    disabled={bulkRunning || verifyRunning || selectedWithOptFix === 0}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm rounded"
                    title={`Aplica correct_option a las ${selectedWithOptFix} aplicables; salta el resto`}
                  >
                    {bulkRunning ? '…' : `Apply solo resp (${selectedWithOptFix})`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {verifyProgress && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded text-sm text-purple-900 dark:text-purple-200">
          {verifyProgress}
        </div>
      )}

      {bulkResult && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded text-sm text-green-900 dark:text-green-200">
          <strong>Bulk apply completado:</strong> {bulkResult.applied} aplicadas, {bulkResult.skipped} skipped, {bulkResult.failed} fallidas
          {bulkResult.details && <div className="mt-1 text-xs text-green-800 dark:text-green-300">{bulkResult.details}</div>}
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Cargando…</div>}

      {!loading && questions.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Cola vacía 🎉
        </div>
      )}

      <div className="space-y-4">
        {questions.map(q => {
          const isVirtualLaw = q.topic_review_status?.startsWith('tech_') ?? false
          const ai = q.ai_verification
          const hasExplFix = !!(ai?.explanation_fix && ai.explanation_fix.trim().length > 0)
          const hasOptFix = !!(ai?.correct_option_should_be && ai.correct_option_should_be.trim().length > 0)
          const isApplying = applying === q.id

          const isSelected = selectedIds.has(q.id)
          return (
            <div key={q.id} className={`border rounded-lg p-4 bg-white dark:bg-gray-800 ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(q.id)}
                    className="mt-0.5 cursor-pointer"
                  />
                  <code>{q.id.substring(0, 8)}</code>
                  {q.law_short_name && ` · ${q.law_short_name}`}
                  {q.article_number && ` · Art. ${q.article_number}`}
                  {q.topic_review_status && ` · legacy: ${q.topic_review_status}`}
                </div>
                <a
                  href={`/debug/question/${q.id}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Debug ↗
                </a>
              </div>

              <div className="font-medium text-gray-900 dark:text-white mb-3">{q.question_text}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm mb-3">
                {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((key, idx) => {
                  const text = q[key]
                  if (!text) return null
                  const isCorrect = q.correct_option === idx
                  const aiSuggestsThis = ai?.correct_option_should_be?.toUpperCase() === LETTER[idx]
                  return (
                    <div
                      key={key}
                      className={`p-2 rounded border ${
                        isCorrect
                          ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                          : aiSuggestsThis
                          ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <span className="font-bold mr-2">{LETTER[idx]})</span>
                      {text}
                      {isCorrect && <span className="ml-2 text-xs text-green-700 dark:text-green-300">(actual)</span>}
                      {aiSuggestsThis && !isCorrect && (
                        <span className="ml-2 text-xs text-yellow-700 dark:text-yellow-300">(IA sugiere)</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Bloque AI verification */}
              {ai && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-semibold">IA</span> {ai.ai_provider}
                    {ai.ai_model && ` · ${ai.ai_model}`}
                    {ai.confidence && ` · confianza: ${ai.confidence}`}
                    {' · '}
                    article_ok={String(ai.article_ok)} answer_ok={String(ai.answer_ok)} explanation_ok={String(ai.explanation_ok)}
                  </div>
                  {ai.explanation && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 italic">
                      Análisis: {ai.explanation}
                    </div>
                  )}
                  {hasExplFix && (
                    <div className="text-sm mb-2">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">Explicación sugerida:</div>
                      <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap p-2 bg-white dark:bg-gray-800 rounded border mt-1">
                        {ai.explanation_fix}
                      </div>
                    </div>
                  )}
                  {hasOptFix && (
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Respuesta sugerida: </span>
                      <span className="font-bold text-yellow-700 dark:text-yellow-300">{ai.correct_option_should_be}</span>
                    </div>
                  )}
                  {ai.correct_article_suggestion && (
                    <div className="text-sm mt-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Artículo sugerido: </span>
                      <code>{ai.correct_article_suggestion}</code>
                      <span className="ml-2 text-xs text-gray-500">(no aplicable en MVP — cambiar manualmente)</span>
                    </div>
                  )}
                </div>
              )}

              {!ai && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ No hay verificación IA disponible (probablemente backfill de admin manual). Solo opción manual.
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap gap-2">
                {hasExplFix && hasOptFix && (
                  <button
                    onClick={() => applyFix(q.id, true, true, isVirtualLaw)}
                    disabled={isApplying}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded font-medium"
                  >
                    {isApplying ? '…' : '✅ Apply ambos fixes → approved'}
                  </button>
                )}
                {hasExplFix && (
                  <button
                    onClick={() => applyFix(q.id, true, false, isVirtualLaw)}
                    disabled={isApplying}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm rounded"
                  >
                    Apply solo explicación → approved
                  </button>
                )}
                {hasOptFix && (
                  <button
                    onClick={() => applyFix(q.id, false, true, isVirtualLaw)}
                    disabled={isApplying}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm rounded"
                  >
                    Apply solo respuesta → approved
                  </button>
                )}
                <button
                  onClick={() => markAsState(q.id, q.lifecycle_state, isVirtualLaw ? 'tech_approved' : 'approved')}
                  disabled={isApplying}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                >
                  Marcar perfect (sin fix)
                </button>
                <button
                  onClick={() => markAsState(q.id, q.lifecycle_state, 'needs_human')}
                  disabled={isApplying}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-sm rounded"
                >
                  Escalar a humano
                </button>
                <button
                  onClick={() => markAsState(q.id, q.lifecycle_state, 'retired_irreparable')}
                  disabled={isApplying}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm rounded"
                >
                  Jubilar (irrecuperable)
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
