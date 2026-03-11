// components/OposicionGuard.tsx
// Gate que bloquea acceso a tests si el usuario no tiene oposición seleccionada.
// Muestra un selector agrupado por administración con buscador.
'use client'

import { useState, useMemo } from 'react'
import { useOposicion } from '@/contexts/OposicionContext'
import { OFFICIAL_OPOSICIONES, type OposicionItem } from './OnboardingModal'

// Orden de las agrupaciones por administración
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

export default function OposicionGuard() {
  const { changeOposicion } = useOposicion()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    const list: OposicionItem[] = term
      ? OFFICIAL_OPOSICIONES.filter((o: OposicionItem) =>
          o.nombre.toLowerCase().includes(term) ||
          o.categoria.toLowerCase().includes(term) ||
          o.administracion.toLowerCase().includes(term)
        )
      : OFFICIAL_OPOSICIONES

    // Agrupar por administración
    const groups: Record<string, OposicionItem[]> = {}
    for (const op of list) {
      const key = op.administracion
      if (!groups[key]) groups[key] = []
      groups[key].push(op)
    }

    // Ordenar grupos según ADMIN_ORDER
    const sorted: [string, OposicionItem[]][] = []
    for (const admin of ADMIN_ORDER) {
      if (groups[admin]) {
        sorted.push([admin, groups[admin]])
        delete groups[admin]
      }
    }
    // Cualquier grupo no previsto al final
    for (const [admin, items] of Object.entries(groups)) {
      sorted.push([admin, items])
    }

    return sorted
  }, [search])

  const handleSelect = async (oposicionId: string) => {
    setSaving(true)
    try {
      await changeOposicion(oposicionId, false)
      window.location.reload()
    } catch {
      setSaving(false)
    }
  }

  const handleExplorador = () => handleSelect('explorador')

  if (saving) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
            Configurando tu oposición...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          {/* Header */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Selecciona tu oposición
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-5">
            Para que los tests se adapten a tu temario, necesitamos saber qué oposición preparas.
          </p>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar oposición..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
            autoFocus
          />

          {/* Lista agrupada */}
          <div className="max-h-[50vh] overflow-y-auto space-y-4 mb-4 pr-1">
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
                      <span className="text-lg flex-shrink-0">{op.icon}</span>
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

          {/* Separador + botón explorador */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={handleExplorador}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors text-sm font-medium"
            >
              Ninguna de estas / Solo estoy explorando
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
