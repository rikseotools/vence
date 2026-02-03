// components/ExamActionsDropdown.tsx
// Action buttons for completed official exam cards
// Visible buttons with text labels for better UX
'use client'

import { useRouter } from 'next/navigation'

interface ExamActionsDropdownProps {
  examDate: string
  parte: 'primera' | 'segunda'
  oposicion: string
  accuracy?: number
}

export default function ExamActionsDropdown({
  examDate,
  parte,
  oposicion,
}: ExamActionsDropdownProps) {
  const router = useRouter()

  const handleAction = (e: React.MouseEvent, action: 'repeat' | 'repeat-failed' | 'view-failures' | 'review') => {
    e.preventDefault()
    e.stopPropagation()

    const baseUrl = `/${oposicion}/test`
    const params = `fecha=${examDate}&parte=${parte}`

    switch (action) {
      case 'repeat':
        router.push(`${baseUrl}/examen-oficial?${params}`)
        break
      case 'repeat-failed':
        router.push(`${baseUrl}/repaso-fallos-oficial?${params}`)
        break
      case 'view-failures':
        router.push(`${baseUrl}/ver-fallos?${params}`)
        break
      case 'review':
        router.push(`${baseUrl}/revisar-examen?${params}`)
        break
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1 ml-1">
      {/* Repetir examen */}
      <button
        onClick={(e) => handleAction(e, 'repeat')}
        className="px-1 py-0.5 rounded bg-white/20 hover:bg-white/40 transition-colors text-[10px] sm:text-xs font-medium text-white flex items-center gap-0.5"
        title="Repetir examen"
      >
        <span className="text-xs">🔄</span>
        <span>Repetir</span>
      </button>

      {/* Repasar fallos */}
      <button
        onClick={(e) => handleAction(e, 'repeat-failed')}
        className="px-1 py-0.5 rounded bg-white/20 hover:bg-white/40 transition-colors text-[10px] sm:text-xs font-medium text-white flex items-center gap-0.5"
        title="Repasar fallos"
      >
        <span className="text-xs">🎯</span>
        <span>Repasar</span>
      </button>

      {/* Ver fallos */}
      <button
        onClick={(e) => handleAction(e, 'view-failures')}
        className="px-1 py-0.5 rounded bg-white/20 hover:bg-white/40 transition-colors text-[10px] sm:text-xs font-medium text-white flex items-center gap-0.5"
        title="Ver fallos"
      >
        <span className="text-xs">👁️</span>
        <span>Ver</span>
      </button>

      {/* Revisar examen completo */}
      <button
        onClick={(e) => handleAction(e, 'review')}
        className="px-1 py-0.5 rounded bg-white/20 hover:bg-white/40 transition-colors text-[10px] sm:text-xs font-medium text-white flex items-center gap-0.5"
        title="Revisar examen completo"
      >
        <span className="text-xs">📋</span>
        <span>Revisar</span>
      </button>
    </div>
  )
}
