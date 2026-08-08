// components/OposicionChangeModal.tsx
// Modal para cambiar de oposición, mismo comportamiento que las migas de pan.
'use client'

import { useState, useMemo, useEffect } from 'react'
import { CAPAS } from '@/lib/ui/capas'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import { OFFICIAL_OPOSICIONES, type OposicionItem } from './OnboardingModal'
import { setTargetOposicion } from '@/lib/api/setTargetOposicion'
import { matchesOposicion, sortByCoverageLevel, findBuiltEquivalent, builtDisplayName } from '@/lib/utils/searchOposicion'
import { useOposicionesCatalog } from '@/lib/hooks/useOposicionesCatalog'
import CcaaFlag, { hasCcaaFlag } from './CcaaFlag'

const ADMIN_ORDER = [
  'Estado',
  'Autonómica',
  'Local',
  'Justicia',
  'Educación',
  'Sanitaria',
  'Estatal',
]

const ADMIN_ICONS: Record<string, string> = {
  'Estado': '🏛️',
  'Autonómica': '🏰',
  'Local': '🏘️',
  'Justicia': '⚖️',
  'Educación': '📚',
  'Sanitaria': '🏥',
  'Estatal': '📬',
}

// Mapeo id → slug y nombre desde config central
const OPOSICION_MAP = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, { slug: o.slug, name: o.name }])
)

interface Props {
  open: boolean
  onClose: () => void
  /** Si se pasa, el modal solo notifica la selección sin guardar en BD ni navegar */
  onSelect?: (oposicionId: string) => void
}

export default function OposicionChangeModal({ open, onClose, onSelect }: Props) {
  const router = useRouter()
  const { user } = useAuth() as { user: { id: string } | null }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  // Mensaje cuando el usuario elige una oposición que aún no está
  // implementada. La demanda queda capturada en user_profiles.target_oposicion.
  // `equivalente`: si YA existe una construida con el mismo nombre/alias
  // (T-562), se ofrece en vez de dejar a la persona en un callejón sin salida.
  const [pendingOposicion, setPendingOposicion] = useState<{
    id: string
    nombre: string
    equivalente?: { id: string; nombre: string }
  } | null>(null)

  useEffect(() => {
    if (open) {
      setSearch('')
      setPendingOposicion(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Catálogo desde BD (fallback al array estático para SSR + zero downtime).
  const catalog = useOposicionesCatalog(OFFICIAL_OPOSICIONES)

  // Lookup de aliases desde el config central de oposiciones.ts (single source of truth)
  const aliasesById = useMemo(
    () => Object.fromEntries(OPOSICIONES.map(o => [o.id, o.aliases || []])),
    []
  )

  const filtered = useMemo(() => {
    const term = search.trim()
    const matched: OposicionItem[] = term
      ? catalog.filter((o: OposicionItem) =>
          matchesOposicion({ ...o, aliases: aliasesById[o.id] }, term)
        )
      : catalog
    // Más construida primero (T-562): sin esto, una entrada catalogada con 0
    // preguntas puede salir ANTES que su equivalente con miles solo por orden
    // alfabético — es justo el callejón que dejó a Elisabet sin oposición.
    const list = sortByCoverageLevel(matched)

    const groups: Record<string, OposicionItem[]> = {}
    for (const op of list) {
      const key = op.administracion
      if (!groups[key]) groups[key] = []
      groups[key].push(op)
    }

    const sorted: [string, OposicionItem[]][] = []
    for (const admin of ADMIN_ORDER) {
      if (groups[admin]) {
        sorted.push([admin, groups[admin]])
        delete groups[admin]
      }
    }
    for (const [admin, items] of Object.entries(groups)) {
      sorted.push([admin, items])
    }

    return sorted
  }, [search, aliasesById, catalog])

  const handleSelect = async (oposicionId: string) => {
    // Modo formulario: solo notificar la selección
    if (onSelect) {
      onSelect(oposicionId)
      onClose()
      return
    }

    // Modo navegación: guardar en BD y navegar
    const info = OPOSICION_MAP[oposicionId]

    // Oposición NO implementada todavía (está en OFFICIAL_OPOSICIONES pero no
    // en OPOSICIONES). Mostramos mensaje inline — pero guardamos igualmente
    // target_oposicion para capturar la demanda real (podremos consultar
    // user_profiles GROUP BY target_oposicion para priorizar qué crear).
    if (!info) {
      const oposItem = OFFICIAL_OPOSICIONES.find((o: OposicionItem) => o.id === oposicionId)
      const nombre = oposItem?.nombre || oposicionId
      if (user) {
        // Escritura centralizada (endpoint server, sin stringify). Captura
        // demanda de oposiciones aún no implementadas igual que antes.
        await setTargetOposicion(oposicionId).catch(() => {})
      }
      // ── ¿YA HAY UNA CONSTRUIDA CON ESTE MISMO NOMBRE? (T-562) ────────────
      // Antes esto era un callejón sin salida: se guardaba la demanda y se
      // enseñaba "en elaboración" aunque la oposición YA estuviera construida
      // con otro nombre de catálogo (p.ej. "Auxiliar de Biblioteca" elegida,
      // "Auxiliar de Biblioteca (Estado)" ya viva con 13.891 preguntas). Se
      // busca con el MISMO matcher que la caja de búsqueda, así que si el
      // nombre está en sus aliases, aparece.
      const equivalente = findBuiltEquivalent(OPOSICIONES, nombre)
      setPendingOposicion({
        id: oposicionId,
        nombre,
        // builtDisplayName (T-562): el mismo motivo por el que las listas ya
        // no usan el nombre de BOE — sin esto sería "Ir a Auxiliar de
        // Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas)"
        // en vez de "Ir a Auxiliar de Biblioteca (Estado)".
        equivalente: equivalente ? { id: equivalente.id, nombre: builtDisplayName(equivalente) } : undefined,
      })
      return
    }

    setSaving(true)

    if (user) {
      try {
        // Escritura centralizada (endpoint server, shape canónico, sin stringify).
        const result = await setTargetOposicion(oposicionId)
        if (result.ok) {
          window.dispatchEvent(new CustomEvent('oposicionAssigned', { detail: { oposicionId } }))
          window.dispatchEvent(new CustomEvent('profileUpdated'))
        }
      } catch {
        // Navegar igualmente
      }
    }

    onClose()
    router.push(`/${info.slug}/test?oposicionCambiada=${encodeURIComponent(info.name)}`)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: CAPAS.modal }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {saving ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
              Cambiando oposición...
            </p>
          </div>
        ) : pendingOposicion ? (
          <div className="py-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">{pendingOposicion.equivalente ? '👀' : '🔜'}</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {pendingOposicion.nombre}
              </h3>
              {pendingOposicion.equivalente ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Esta no está construida con ese nombre, pero <strong>ya tenemos</strong>{' '}
                  <strong>{pendingOposicion.equivalente.nombre}</strong>, que es la misma oposición.
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Esta oposición <strong>aún no está disponible</strong>. Estamos trabajando en ella y queda registrado tu interés — te avisaremos en cuanto esté lista.
                </p>
              )}
            </div>
            {pendingOposicion.equivalente && (
              <button
                onClick={() => handleSelect(pendingOposicion.equivalente!.id)}
                className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors mb-2"
              >
                Ir a {pendingOposicion.equivalente.nombre}
              </button>
            )}
            <button
              onClick={onClose}
              className={
                pendingOposicion.equivalente
                  ? 'w-full py-3 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors'
                  : 'w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors'
              }
            >
              {pendingOposicion.equivalente ? 'No, gracias' : 'Entendido'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cambiar oposición
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar oposición..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
              autoFocus
            />

            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
              {filtered.map(([admin, items]) => (
                <div key={admin}>
                  <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 sticky top-0 bg-white dark:bg-gray-800 py-1">
                    {ADMIN_ICONS[admin] || '📋'} {admin}
                  </h3>
                  <div className="space-y-1">
                    {items.map((op: OposicionItem) => {
                      const isImplemented = !!OPOSICION_MAP[op.id]
                      return (
                        <button
                          key={op.id}
                          onClick={() => handleSelect(op.id)}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                        >
                          <span className="text-lg flex-shrink-0">
                            {hasCcaaFlag(op.id) ? <CcaaFlag oposicionId={op.id} /> : op.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 block break-words">
                              {/* short_name es el nombre corto pensado para UI (T-562): el
                                  de BOE puede llegar truncado en una línea, p.ej. "Auxiliar
                                  de Archivos, Bibliotecas y Museos del Estado (Sección
                                  Bibliotec…". Solo lo trae el catálogo real, no el fallback
                                  estático — por eso el || . */}
                              {op.short_name || op.nombre}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {op.categoria}
                            </span>
                          </div>
                          {!isImplemented && (
                            <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                              🔜 En elaboración
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                  No se encontraron oposiciones con &quot;{search}&quot;
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
