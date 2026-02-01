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

  const handleAction = (e: React.MouseEvent, action: 'repeat' | 'repeat-failed' | 'view-failures') => {
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
    }
  }

  return (
    <div className="flex items-center gap-2 ml-2">
      {/* Repetir examen */}
      <button
        onClick={(e) => handleAction(e, 'repeat')}
        className="px-2 py-1 rounded-md bg-white/20 hover:bg-white/40 transition-colors text-xs font-medium text-white flex items-center gap-1"
      >
        <span>🔄</span>
        <span>Repetir</span>
      </button>

      {/* Repasar fallos */}
      <button
        onClick={(e) => handleAction(e, 'repeat-failed')}
        className="px-2 py-1 rounded-md bg-white/20 hover:bg-white/40 transition-colors text-xs font-medium text-white flex items-center gap-1"
      >
        <span>🎯</span>
        <span>Repasar fallos</span>
      </button>

      {/* Ver fallos */}
      <button
        onClick={(e) => handleAction(e, 'view-failures')}
        className="px-2 py-1 rounded-md bg-white/20 hover:bg-white/40 transition-colors text-xs font-medium text-white flex items-center gap-1"
      >
        <span>👁️</span>
        <span>Ver fallos</span>
      </button>
    </div>
  )
}
