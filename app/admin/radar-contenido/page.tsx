'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface RadarPost {
  id: string
  permalink: string
  competitor_name: string
  handle: string
  followers_count: number | null
  caption: string | null
  media_type: string | null
  like_count: number
  comments_count: number
  engagement: number
  engagement_rate: number | null
  posted_at: string | null
  rank_kind: string | null
  seen: boolean
}

interface RadarData {
  success: boolean
  posts: RadarPost[]
  fetchedAt: string | null
  unseen: number
}

const TYPE_ICON: Record<string, string> = {
  VIDEO: '🎬',
  IMAGE: '🖼️',
  CAROUSEL_ALBUM: '🎠',
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-ES').format(n)
}

export default function RadarContenidoPage() {
  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch('/api/admin/radar-contenido', { headers })
      const json = await res.json()
      setData(json)
      // Marcar como vistas al abrir (baja el badge del nav).
      await adminFetch('/api/admin/radar-contenido', { method: 'POST', headers })
    } catch (err) {
      console.error('radar-contenido load error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const posts = data?.posts ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          📡 Radar de Contenido
        </h1>
        <a
          href="https://github.com/rikseotools/vence/blob/main/docs/runbooks/radar-contenido-social.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          📘 Runbook
        </a>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Lo que más funciona en el Instagram de nuestros competidores. Coge el{' '}
        <strong>concepto</strong> (gancho, formato), <strong>nunca la imagen</strong>, y publica tu
        versión original con nuestra marca. Recomendado: ~3 posts de marca/semana además de la
        pregunta del día.
      </p>

      <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
        ⚠️ <strong>Regla de oro:</strong> nunca reutilizar su imagen/vídeo (copyright + política IG +
        reputación). Solo el concepto, siempre original.
      </div>

      {loading && <p className="text-gray-500">Cargando…</p>}
      {!loading && posts.length === 0 && (
        <p className="text-gray-500">
          Sin datos todavía. El radar se refresca L/X/V.
        </p>
      )}

      {!loading && posts.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {posts.length} posts · actualizado{' '}
            {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleDateString('es-ES') : '—'}
          </p>
          <div className="space-y-3">
            {posts.map((p, i) => (
              <div
                key={p.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 font-mono">{i + 1}.</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {p.competitor_name}
                    </span>
                    <span className="text-gray-400">@{p.handle}</span>
                    {p.rank_kind === 'rate' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                        alto % engagement
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span title="engagement (likes+comentarios)">
                      ❤️ {fmt(p.engagement)}
                    </span>
                    {p.engagement_rate != null && (
                      <span
                        className="text-gray-500"
                        title="engagement / seguidores"
                      >
                        {(p.engagement_rate * 100).toFixed(1)}%
                      </span>
                    )}
                    <span title={p.media_type ?? ''}>
                      {TYPE_ICON[p.media_type ?? ''] ?? '📄'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {p.caption || <em className="text-gray-400">(sin texto)</em>}
                </p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>
                    {fmt(p.followers_count)} seg ·{' '}
                    {p.posted_at ? new Date(p.posted_at).toLocaleDateString('es-ES') : '—'}
                  </span>
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Ver post ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
