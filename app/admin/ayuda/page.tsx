// app/admin/ayuda/page.tsx - Monitor de artículos de ayuda
'use client'

import { useState, useEffect } from 'react'

interface HelpArticle {
  id: string
  slug: string
  title: string
  category: string
  content: string
  keywords: string[]
  related_urls: string[]
  related_paths: string[]
  is_published: boolean
  updated_at: string
  needs_review: boolean
  review_reason: string | null
  has_embedding: boolean
  content_length: number
  days_since_update: number
}

interface StatusSummary {
  total: number
  published: number
  outdated: number // >30 days sin actualizar
  noEmbedding: number
  shortContent: number // <200 chars
}

export default function AdminAyudaPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [summary, setSummary] = useState<StatusSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
  }, [])

  async function loadArticles() {
    try {
      const res = await fetch('/api/v2/admin/help-articles')
      if (!res.ok) throw new Error('Error cargando artículos')
      const data = await res.json()
      setArticles(data.articles)
      setSummary(data.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    )
  }

  const CATEGORY_LABELS: Record<string, string> = {
    tests: 'Tests y practica',
    contenido: 'Contenido y temario',
    funcionalidades: 'Funcionalidades',
    cuenta: 'Cuenta y suscripcion',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📖</span> Centro de Ayuda
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor de articulos de ayuda para el chat IA y paginas publicas
          </p>
        </div>
        <a
          href="/ayuda"
          target="_blank"
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Ver publico
        </a>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600">{summary.published}</div>
            <div className="text-xs text-gray-500">Publicados</div>
          </div>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${summary.outdated > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className={`text-2xl font-bold ${summary.outdated > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{summary.outdated}</div>
            <div className="text-xs text-gray-500">Desactualizados (&gt;30d)</div>
          </div>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${summary.noEmbedding > 0 ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className={`text-2xl font-bold ${summary.noEmbedding > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary.noEmbedding}</div>
            <div className="text-xs text-gray-500">Sin embedding</div>
          </div>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${summary.shortContent > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className={`text-2xl font-bold ${summary.shortContent > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{summary.shortContent}</div>
            <div className="text-xs text-gray-500">Contenido corto</div>
          </div>
        </div>
      )}

      {/* Alerta de artículos afectados por deploy */}
      {articles.some(a => a.needs_review) && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {articles.filter(a => a.needs_review).length} articulo(s) afectados por cambios recientes
            </span>
          </div>
          {articles.filter(a => a.needs_review).map(a => (
            <div key={a.id} className="text-sm text-amber-700 dark:text-amber-300 ml-7 mb-1">
              <strong>{a.title}</strong>: {a.review_reason}
            </div>
          ))}
          <p className="text-xs text-amber-600 dark:text-amber-400 ml-7 mt-2">
            Pide a Claude Code que actualice estos articulos con los cambios.
          </p>
        </div>
      )}

      {/* Lista de artículos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Articulo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Chars</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Embedding</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actualizado</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {articles.map(art => {
              const isOutdated = art.days_since_update > 30
              const isShort = art.content_length < 200
              const noEmb = !art.has_embedding

              return (
                <tr key={art.id} className={`${isOutdated || noEmb ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                  <td className="px-4 py-3">
                    <a
                      href={`/ayuda/${art.slug}`}
                      target="_blank"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {art.title}
                    </a>
                    <div className="text-xs text-gray-400 mt-0.5">/{art.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {CATEGORY_LABELS[art.category] || art.category}
                  </td>
                  <td className={`px-4 py-3 text-sm text-center ${isShort ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                    {art.content_length}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {art.has_embedding
                      ? <span className="text-green-500 text-sm">OK</span>
                      : <span className="text-red-500 text-sm font-medium">FALTA</span>
                    }
                  </td>
                  <td className={`px-4 py-3 text-sm text-center ${isOutdated ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                    {art.days_since_update === 0 ? 'hoy' : `hace ${art.days_since_update}d`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {art.needs_review ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" title={art.review_reason || ''}>Deploy</span>
                    ) : noEmb ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Sin RAG</span>
                    ) : isOutdated ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Revisar</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
        Los articulos se usan para el RAG del chat IA y las paginas publicas /ayuda.
        Para actualizar contenido, usa Claude Code.
      </p>
    </div>
  )
}
