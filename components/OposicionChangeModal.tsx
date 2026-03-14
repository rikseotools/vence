// components/OposicionChangeModal.tsx
// Modal para cambiar de oposición, mismo comportamiento que las migas de pan.
'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import { getSupabaseClient } from '@/lib/supabase'
import { OFFICIAL_OPOSICIONES, type OposicionItem } from './OnboardingModal'
import CcaaFlag, { hasCcaaFlag } from './CcaaFlag'

const supabase = getSupabaseClient()

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

  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    const list: OposicionItem[] = term
      ? OFFICIAL_OPOSICIONES.filter((o: OposicionItem) =>
          o.nombre.toLowerCase().includes(term) ||
          o.categoria.toLowerCase().includes(term) ||
          o.administracion.toLowerCase().includes(term)
        )
      : OFFICIAL_OPOSICIONES

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
  }, [search])

  const handleSelect = async (oposicionId: string) => {
    // Modo formulario: solo notificar la selección
    if (onSelect) {
      onSelect(oposicionId)
      onClose()
      return
    }

    // Modo navegación: guardar en BD y navegar
    setSaving(true)

    const info = OPOSICION_MAP[oposicionId]
    if (!info) {
      setSaving(false)
      return
    }

    if (user) {
      try {
        const newOposicionData = { id: oposicionId, name: info.name }
        const { error } = await supabase
          .from('user_profiles')
          .update({
            target_oposicion: oposicionId,
            target_oposicion_data: JSON.stringify(newOposicionData),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (!error) {
          window.dispatchEvent(new CustomEvent('oposicionAssigned'))
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                    {items.map((op: OposicionItem) => (
                      <button
                        key={op.id}
                        onClick={() => handleSelect(op.id)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                      >
                        <span className="text-lg flex-shrink-0">
                          {hasCcaaFlag(op.id) ? <CcaaFlag oposicionId={op.id} /> : op.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 block truncate">
                            {op.nombre}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {op.categoria}
                          </span>
                        </div>
                      </button>
                    ))}
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
