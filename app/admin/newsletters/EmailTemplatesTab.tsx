// app/admin/newsletters/EmailTemplatesTab.tsx
// Pestaña de gestión de plantillas de email desde BD
'use client'
import { useState, useEffect, useCallback } from 'react'

interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'url' | 'list'
  default_value?: string
}

interface EmailTemplate {
  id: string
  slug: string
  name: string
  category: string
  subjectTemplate: string
  htmlTemplate: string
  variables: TemplateVariable[]
  previewData: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PreviewResult {
  subject: string
  html: string
}

type ViewMode = 'list' | 'edit' | 'preview' | 'send'

export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [sendAudience, setSendAudience] = useState('all')
  const [sendTestMode, setSendTestMode] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    slug: '',
    name: '',
    category: 'broadcast' as string,
    subjectTemplate: '',
    htmlTemplate: '',
    variables: [] as TemplateVariable[],
    previewData: {} as Record<string, unknown>,
  })
  const [isNew, setIsNew] = useState(false)

  // Obtener token de sesión
  useEffect(() => {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(({ data }: { data: { session: { access_token: string } | null } }) => {
      setAuthToken(data.session?.access_token || null)
    })
  }, [])

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
  }

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/newsletters/templates', { headers })
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates)
      }
    } catch (err) {
      console.error('Error cargando plantillas:', err)
    } finally {
      setLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Abrir editor con plantilla existente
  const openEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setEditForm({
      slug: template.slug,
      name: template.name,
      category: template.category,
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      variables: template.variables || [],
      previewData: template.previewData || {},
    })
    setIsNew(false)
    setViewMode('edit')
  }

  // Abrir editor para nueva plantilla
  const openNew = () => {
    setSelectedTemplate(null)
    setEditForm({
      slug: '',
      name: '',
      category: 'broadcast',
      subjectTemplate: '',
      htmlTemplate: '',
      variables: [],
      previewData: {},
    })
    setIsNew(true)
    setViewMode('edit')
  }

  // Guardar plantilla
  const saveTemplate = async () => {
    setSaving(true)
    try {
      const url = isNew
        ? '/api/admin/newsletters/templates'
        : `/api/admin/newsletters/templates/${selectedTemplate!.slug}`
      const method = isNew ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(editForm),
      })
      const data = await res.json()

      if (data.success) {
        await loadTemplates()
        setViewMode('list')
      } else {
        alert(data.error || 'Error guardando plantilla')
      }
    } catch (err) {
      alert('Error guardando plantilla')
    } finally {
      setSaving(false)
    }
  }

  // Preview
  const loadPreview = async (template: EmailTemplate, vars?: Record<string, string>) => {
    setSelectedTemplate(template)
    const varsToUse = vars || Object.fromEntries(
      (template.variables || []).map(v => [v.key, (template.previewData as Record<string, string>)?.[v.key] || v.default_value || ''])
    )
    setPreviewVars(varsToUse)

    try {
      const res = await fetch('/api/admin/newsletters/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          templateSlug: template.slug,
          variables: varsToUse,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPreview({ subject: data.subject, html: data.html })
      }
    } catch (err) {
      console.error('Error preview:', err)
    }
    setViewMode('preview')
  }

  const updatePreviewVar = (key: string, value: string) => {
    const newVars = { ...previewVars, [key]: value }
    setPreviewVars(newVars)
    if (selectedTemplate) {
      loadPreview(selectedTemplate, newVars)
    }
  }

  // Enviar con plantilla de BD
  const openSend = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setSendResult(null)
    setSendTestMode(true)
    setSendAudience('all')
    // Inicializar variables de envío con preview_data
    const vars: Record<string, string> = {}
    for (const v of template.variables || []) {
      vars[v.key] = (template.previewData as Record<string, string>)?.[v.key] || v.default_value || ''
    }
    setPreviewVars(vars)
    setViewMode('send')
  }

  const sendNewsletter = async () => {
    if (!selectedTemplate) return
    setSending(true)
    setSendResult(null)

    try {
      const res = await fetch('/api/admin/newsletters/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          templateSlug: selectedTemplate.slug,
          templateVariables: previewVars,
          audienceType: sendAudience,
          testMode: sendTestMode,
        }),
      })
      const data = await res.json()
      setSendResult({
        success: data.success,
        message: data.success
          ? `${data.testMode ? '[TEST] ' : ''}Enviado a ${data.sent}/${data.total} usuarios`
          : data.error || 'Error enviando',
      })
    } catch (err) {
      setSendResult({ success: false, message: 'Error de conexion' })
    } finally {
      setSending(false)
    }
  }

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      broadcast: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      marketing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      transactional: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[cat] || 'bg-gray-100 text-gray-800'}`}>
        {cat}
      </span>
    )
  }

  // ============================================
  // RENDER: LIST VIEW
  // ============================================
  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Plantillas de Email
          </h2>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            + Nueva Plantilla
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Cargando plantillas...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No hay plantillas. Crea la primera.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{t.name}</h3>
                    {categoryBadge(t.category)}
                    {!t.isActive && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    slug: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{t.slug}</code>
                    {' '}&middot;{' '}
                    {(t.variables || []).length} variables
                    {' '}&middot;{' '}
                    Asunto: {t.subjectTemplate.substring(0, 60)}{t.subjectTemplate.length > 60 ? '...' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => loadPreview(t)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    Vista previa
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => openSend(t)}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // RENDER: EDIT VIEW
  // ============================================
  if (viewMode === 'edit') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'Nueva Plantilla' : `Editar: ${selectedTemplate?.name}`}
          </h2>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4">
          {/* Slug + Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug (identificador unico)
              </label>
              <input
                type="text"
                value={editForm.slug}
                onChange={e => setEditForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                disabled={!isNew}
                placeholder="nueva-oposicion"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nueva oposicion disponible"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoria
            </label>
            <select
              value={editForm.category}
              onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="broadcast">Broadcast</option>
              <option value="marketing">Marketing</option>
              <option value="transactional">Transactional</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Asunto (usa {'{{variable}}'} para datos dinamicos)
            </label>
            <input
              type="text"
              value={editForm.subjectTemplate}
              onChange={e => setEditForm(f => ({ ...f, subjectTemplate: e.target.value }))}
              placeholder="Nueva oposicion disponible en Vence.es"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* HTML Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              HTML Template (usa {'{{variable}}'} para datos dinamicos)
            </label>
            <textarea
              value={editForm.htmlTemplate}
              onChange={e => setEditForm(f => ({ ...f, htmlTemplate: e.target.value }))}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              placeholder="<div>...</div>"
            />
          </div>

          {/* Variables */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Variables ({editForm.variables.length})
              </label>
              <button
                onClick={() => setEditForm(f => ({
                  ...f,
                  variables: [...f.variables, { key: '', label: '', type: 'text' as const, default_value: '' }]
                }))}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                + Agregar variable
              </button>
            </div>
            {editForm.variables.map((v, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                <input
                  type="text"
                  value={v.key}
                  onChange={e => {
                    const vars = [...editForm.variables]
                    vars[i] = { ...vars[i], key: e.target.value }
                    setEditForm(f => ({ ...f, variables: vars }))
                  }}
                  placeholder="key"
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={v.label}
                  onChange={e => {
                    const vars = [...editForm.variables]
                    vars[i] = { ...vars[i], label: e.target.value }
                    setEditForm(f => ({ ...f, variables: vars }))
                  }}
                  placeholder="Label"
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  value={v.type}
                  onChange={e => {
                    const vars = [...editForm.variables]
                    vars[i] = { ...vars[i], type: e.target.value as TemplateVariable['type'] }
                    setEditForm(f => ({ ...f, variables: vars }))
                  }}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="text">Texto</option>
                  <option value="number">Numero</option>
                  <option value="url">URL</option>
                  <option value="list">Lista</option>
                </select>
                <button
                  onClick={() => {
                    const vars = editForm.variables.filter((_, j) => j !== i)
                    setEditForm(f => ({ ...f, variables: vars }))
                  }}
                  className="px-2 py-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={saveTemplate}
              disabled={saving || !editForm.slug || !editForm.name || !editForm.subjectTemplate}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Guardando...' : isNew ? 'Crear Plantilla' : 'Guardar Cambios'}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: PREVIEW VIEW
  // ============================================
  if (viewMode === 'preview' && selectedTemplate) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Vista previa: {selectedTemplate.name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => openSend(selectedTemplate)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Enviar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Volver
            </button>
          </div>
        </div>

        {/* Variables editor */}
        {(selectedTemplate.variables || []).length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Variables</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(selectedTemplate.variables || []).map(v => (
                <div key={v.key}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {v.label} ({'{{'}{v.key}{'}}'})</label>
                  <input
                    type="text"
                    value={previewVars[v.key] || ''}
                    onChange={e => updatePreviewVar(v.key, e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject */}
        {preview && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
            <span className="text-xs text-gray-500 dark:text-gray-400">Asunto:</span>
            <p className="font-medium text-gray-900 dark:text-white">{preview.subject}</p>
          </div>
        )}

        {/* HTML Preview */}
        {preview && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <iframe
              srcDoc={preview.html}
              className="w-full bg-white"
              style={{ minHeight: '500px' }}
              title="Email Preview"
            />
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // RENDER: SEND VIEW
  // ============================================
  if (viewMode === 'send' && selectedTemplate) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Enviar: {selectedTemplate.name}
          </h2>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Volver
          </button>
        </div>

        <div className="space-y-6">
          {/* Variables */}
          {(selectedTemplate.variables || []).length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Variables del email</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(selectedTemplate.variables || [])
                  .filter(v => v.key !== 'userName' && v.key !== 'unsubscribeUrl')
                  .map(v => (
                  <div key={v.key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{v.label}</label>
                    <input
                      type="text"
                      value={previewVars[v.key] || ''}
                      onChange={e => setPreviewVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                userName y unsubscribeUrl se rellenan automaticamente por usuario.
              </p>
            </div>
          )}

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audiencia</label>
            <select
              value={sendAudience}
              onChange={e => setSendAudience(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todos los usuarios</option>
              <option value="active">Usuarios activos</option>
              <option value="inactive">Usuarios inactivos</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
              <option value="auxiliar_administrativo_estado">Aux. Administrativo Estado</option>
              <option value="administrativo_estado">Administrativo Estado</option>
              <option value="tramitacion_procesal">Tramitacion Procesal</option>
              <option value="auxilio_judicial">Auxilio Judicial</option>
              <option value="gestion_procesal">Gestion Procesal</option>
            </select>
          </div>

          {/* Test mode */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendTestMode}
              onChange={e => setSendTestMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Modo test (solo primeros 3 usuarios)
            </span>
          </label>

          {/* Send button */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={sendNewsletter}
              disabled={sending}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                sendTestMode
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:bg-gray-400`}
            >
              {sending
                ? 'Enviando...'
                : sendTestMode
                  ? 'Enviar Test (3 usuarios)'
                  : 'Enviar a Todos'}
            </button>
            <button
              onClick={() => loadPreview(selectedTemplate, previewVars)}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
            >
              Ver Preview
            </button>
          </div>

          {/* Result */}
          {sendResult && (
            <div className={`p-4 rounded-lg ${
              sendResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              <p className="font-medium">{sendResult.success ? 'Enviado' : 'Error'}</p>
              <p className="text-sm mt-1">{sendResult.message}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
