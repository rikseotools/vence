'use client'
// components/OpenInscriptionBanner.tsx
//
// Banner global "Inscripción abierta" — captura el ángulo boca-oreja:
// el usuario ya estudia una oposición concreta, pero puede tener un
// familiar o amigo al que le interese una convocatoria distinta cuyo
// plazo está abierto.
//
// Filtrado en cliente:
//   1. Excluir la target_oposicion del propio user (la conoce ya).
//   2. Excluir las que ya dismiseó (server-persisted para logueados,
//      localStorage para anónimos).
//   3. Mostrar la primera (la más urgente — el server las ordena por
//      deadline asc).
//
// Roadmap: docs/roadmap/banner-inscripcion-abierta.md

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { auth } from '@/lib/auth'
import { formatDateLarga, formatNumber } from '../lib/utils/format'
import { emitClientEvent, flushClientObservability } from '@/lib/observability/client'
import { isBannerSnoozed, latestDismiss } from '@/lib/oposiciones/bannerSnooze'

type OpenInscription = {
  slug: string
  nombre: string
  short_name: string | null
  subgrupo: string | null
  plazas_libres: number | null
  inscription_start: string
  inscription_deadline: string
  exam_date: string | null
  boe_reference: string | null
  programa_url: string | null
  color_primario: string | null
}

type ApiResponse = {
  open: OpenInscription[]
  dismissed: string[]
  targetOposicion: string | null
  // último cierre account-level (MAX dismissed_at) — ancla del cooldown cross-device.
  lastDismissedAt?: string | null
}

const LOCALSTORAGE_KEY = 'vence_dismissed_inscription_banners'
// Timestamp ISO del último cierre en ESTE dispositivo (cooldown anónimo + respuesta
// inmediata en logueados antes de que el server lo refleje).
const LAST_DISMISS_KEY = 'vence_inscription_banner_last_dismiss'

function readLocalLastDismiss(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_DISMISS_KEY)
  } catch {
    return null
  }
}

function writeLocalLastDismiss(iso: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_DISMISS_KEY, iso)
  } catch {
    // localStorage no disponible: ignorar (el cooldown server lo tapa en logueados).
  }
}

function readLocalDismisses(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : []
  } catch {
    return []
  }
}

function writeLocalDismisses(slugs: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(slugs))
  } catch {
    // localStorage no disponible (modo privado Safari, cuota llena): ignorar.
  }
}

export default function OpenInscriptionBanner() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [localDismisses, setLocalDismisses] = useState<string[]>([])
  const [localLastDismiss, setLocalLastDismiss] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Inicializar dismisses + último cierre de localStorage tras mount (evita hydration mismatch).
  useEffect(() => {
    setLocalDismisses(readLocalDismisses())
    setLocalLastDismiss(readLocalLastDismiss())
  }, [])

  // Fetch al banner endpoint. Espera a que auth termine de cargar para
  // enviar el bearer si lo hay (anon también funciona, sin header).
  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    ;(async () => {
      try {
        const headers: Record<string, string> = {}
        if (user) {
          const token = await auth.getAccessToken()
          if (token) {
            headers.Authorization = `Bearer ${token}`
          }
        }
        const res = await fetch('/api/v2/banner/open-inscriptions', { headers })
        if (!res.ok) {
          setLoaded(true)
          return
        }
        const json = (await res.json()) as ApiResponse
        if (!cancelled) {
          setData(json)
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  // Picker: elige la primera open que no sea target y no esté dismissed.
  // user_profiles.target_oposicion guarda positionType con underscores
  // (auxiliar_administrativo_estado); oposiciones.slug usa guiones. El
  // endpoint ya normaliza, pero el fallback a userProfile no, así que
  // también convertimos aquí por defensa en profundidad.
  const pick = useCallback((): OpenInscription | null => {
    if (!data || data.open.length === 0) return null
    const targetRaw = data.targetOposicion ?? userProfile?.target_oposicion ?? null
    const target = targetRaw?.replace(/_/g, '-') ?? null
    const dismissedSet = new Set([...data.dismissed, ...localDismisses])
    return (
      data.open.find((o) => o.slug !== target && !dismissedSet.has(o.slug)) ?? null
    )
  }, [data, localDismisses, userProfile?.target_oposicion])

  const handleDismiss = useCallback(
    async (slug: string) => {
      // Observabilidad: registrar el cierre por convocatoria (antes era ciego).
      emitClientEvent({ severity: 'info', eventType: 'banner_inscription_dismissed', metadata: { slug } })

      // Optimistic: añadir a localDismisses ya, persistir después.
      setLocalDismisses((prev) => {
        const next = prev.includes(slug) ? prev : [...prev, slug]
        writeLocalDismisses(next)
        return next
      })
      // Activar el cooldown YA en este dispositivo (no esperar al refetch del server).
      const nowIso = new Date().toISOString()
      setLocalLastDismiss(nowIso)
      writeLocalLastDismiss(nowIso)

      if (!user) return // anon: ya está en localStorage, no llamamos API.

      try {
        const token = await auth.getAccessToken()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        await fetch('/api/v2/banner/open-inscriptions/dismiss', {
          method: 'POST',
          headers,
          body: JSON.stringify({ oposicion_slug: slug }),
        })
      } catch {
        // Si falla la persistencia, el localStorage la tapa. En la próxima
        // sesión sin localStorage el banner volvería — aceptable.
      }
    },
    [user],
  )

  // Cooldown anti-martilleo: tras CUALQUIER cierre, silencio durante el cooldown.
  // Ancla = el más reciente entre el server (cross-device) y el local (inmediato).
  const lastDismiss = latestDismiss(data?.lastDismissedAt ?? null, localLastDismiss)
  const ready = !authLoading && loaded
  const snoozed = isBannerSnoozed(lastDismiss, Date.now())
  const chosen = ready && !snoozed ? pick() : null

  // Observabilidad: impresión por convocatoria (antes era ciego). Una vez por slug visible.
  useEffect(() => {
    if (chosen) {
      emitClientEvent({
        severity: 'info',
        eventType: 'banner_inscription_viewed',
        metadata: { slug: chosen.slug },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.slug])

  if (!chosen) return null

  const name = chosen.short_name || chosen.nombre
  const deadlineFmt = formatDateLarga(chosen.inscription_deadline)
  const plazasFmt = chosen.plazas_libres != null ? formatNumber(chosen.plazas_libres) : null

  // Stretched-link pattern: el <a> es absolute inset-0 cubriendo todo
  // el banner. El contenido va por encima con pointer-events-none para
  // que los clicks pasen al <a>; solo el botón X reactiva pointer-events
  // para capturar su click sin navegar (no son hijos uno del otro,
  // así que no hace falta stopPropagation).
  return (
    <div className="relative bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
      <a
        href={`/${chosen.slug}`}
        aria-label={`Ver convocatoria ${name}`}
        className="absolute inset-0 z-0"
        onClick={() => {
          // Apertura por convocatoria. flush con beacon: la navegación inmediata
          // se llevaría por delante el batch si no lo forzamos.
          emitClientEvent({
            severity: 'info',
            eventType: 'banner_inscription_clicked',
            metadata: { slug: chosen.slug },
          })
          flushClientObservability(true)
        }}
      />
      <div className="relative z-10 max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm px-4 py-2.5 pointer-events-none">
        <div className="flex-1 min-w-0 text-emerald-900 dark:text-emerald-100">
          <span className="font-semibold">📢 Convocatoria abierta para {name}</span>
          <span>
            {' '}— Plazo de inscripción <strong>hasta el {deadlineFmt}</strong>
            {plazasFmt && (
              <>
                {' '}
                — <strong>{plazasFmt} plazas</strong>
              </>
            )}
            .
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-block px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-md">
            Ver convocatoria
          </span>
          <button
            type="button"
            onClick={() => handleDismiss(chosen.slug)}
            aria-label="Cerrar aviso de esta oposición"
            className="pointer-events-auto text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 p-1 rounded transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
