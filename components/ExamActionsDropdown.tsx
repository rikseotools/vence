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
    <div className="grid grid-cols-2 gap-2 w-full">
      {/* Repetir examen completo */}
      <button
        onClick={(e) => handleAction(e, 'repeat')}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Repetir el examen completo desde cero"
      >
        <span>🔄</span>
        <span>Repetir examen</span>
      </button>

      {/* Practicar solo los fallos */}
      <button
        onClick={(e) => handleAction(e, 'repeat-failed')}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Practicar solo las preguntas que fallaste"
      >
        <span>🎯</span>
        <span>Practicar fallos</span>
      </button>

      {/* Ver fallos con respuestas */}
      <button
        onClick={(e) => handleAction(e, 'view-failures')}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Ver las preguntas falladas con sus respuestas correctas"
      >
        <span>👁️</span>
        <span>Ver fallos</span>
      </button>

      {/* Revisar examen completo */}
      <button
        onClick={(e) => handleAction(e, 'review')}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Revisar todas las preguntas del examen con sus respuestas"
      >
        <span>📋</span>
        <span>Revisar todo</span>
      </button>
    </div>
  )
}
