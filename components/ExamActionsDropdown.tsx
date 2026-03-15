// components/ExamActionsDropdown.tsx
// Action buttons for completed official exam cards
'use client'

import { useRouter } from 'next/navigation'

interface ExamActionsDropdownProps {
  examDate: string
  parte: string
  oposicion: string
  accuracy?: number
}

export default function ExamActionsDropdown({
  examDate,
  parte,
  oposicion,
}: ExamActionsDropdownProps) {
  const router = useRouter()

  const handleRepeat = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/${oposicion}/test/examen-oficial?fecha=${examDate}&parte=${parte}`)
  }

  const handleViewAttempts = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/mis-estadisticas?examDate=${examDate}&parte=${parte}&oposicion=${oposicion}`)
  }

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      <button
        onClick={handleRepeat}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Repetir el examen completo desde cero"
      >
        <span>🔄</span>
        <span>Repetir examen</span>
      </button>

      <button
        onClick={handleViewAttempts}
        className="px-3 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
        title="Ver todos los intentos de este examen"
      >
        <span>📊</span>
        <span>Ver intentos</span>
      </button>
    </div>
  )
}
