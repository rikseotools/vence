// @ts-nocheck - TODO: Migrate to strict TypeScript
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTopicUnlock } from '@/hooks/useTopicUnlock'
import { slugToPositionType } from '@/lib/config/oposiciones'

// Tipos
interface Tema {
  id: number
  titulo: string
  descripcion: string
  displayNum?: number
  disponible?: boolean
}

interface Bloque {
  id: string
  titulo: string
  icon: string
  temas: Tema[]
  count: number
}

interface TemarioClientProps {
  bloques: Bloque[]
  oposicion: string
  fechaActualizacion: string
}

export default function TemarioClient({ bloques, oposicion, fechaActualizacion }: TemarioClientProps) {
  const { user } = useAuth() as { user: any }
  // Convertir slug de URL a positionType de BD (ej: 'administrativo-estado' -> 'administrativo_estado')
  const positionType = useMemo(() => slugToPositionType(oposicion) || undefined, [oposicion])
  const { getTopicProgress } = useTopicUnlock({ positionType }) as { getTopicProgress: (id: number) => { accuracy: number; questionsAnswered: number } }
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    bloque1: true,
    bloque2: false,
    bloque3: false,
    bloque4: false,
    bloque5: false,
    bloque6: false
  })

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
  }

  const getProgressColor = (accuracy: number) => {
    if (accuracy >= 70) return 'bg-green-500'
    if (accuracy > 0) return 'bg-amber-500'
    return 'bg-gray-200'
  }

  const getProgressBg = (accuracy: number) => {
    if (accuracy >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    if (accuracy > 0) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    return ''
  }

  const renderTema = (tema: Tema) => {
    const progress = user ? getTopicProgress(tema.id) : { accuracy: 0, questionsAnswered: 0 }
    const hasProgress = progress.questionsAnswered > 0
    const displayNumber = tema.displayNum || tema.id
    const isDisponible = tema.disponible !== false

    if (!isDisponible) {
      return (
        <div
          key={tema.id}
          className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">
              {displayNumber}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {tema.titulo}
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              En elaboración · Disponible a partir de abril 2026
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5 text-amber-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium hidden sm:inline">En elaboración</span>
          </div>
        </div>
      )
    }

    return (
      <Link
        key={tema.id}
        href={`/${oposicion}/temario/tema-${tema.id}`}
        className={`group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 ${hasProgress ? getProgressBg(progress.accuracy) : ''}`}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">
            {displayNumber}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {tema.titulo}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {tema.descripcion}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {hasProgress && (
            <div className="text-right hidden sm:block">
              <div className={`text-sm font-semibold ${progress.accuracy >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                {progress.accuracy}%
              </div>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getProgressColor(progress.accuracy)}`}
                  style={{ width: `${Math.min(100, progress.accuracy)}%` }}
                />
              </div>
            </div>
          )}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    )
  }

  return (
    <>
      {/* Banner registro para usuarios no logueados */}
      {!user && (
        <div className="max-w-4xl mx-auto mb-8 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-white">Siempre actualizado.</span>{' '}
                Regístrate para recibir avisos cuando cambie la legislación.
              </p>
            </div>
            <Link
              href="/login"
              className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      )}

      {/* Bloques del temario - interactivos */}
      <div className="max-w-4xl mx-auto space-y-4">
        {bloques.map((bloque) => (
          <div key={bloque.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleBlock(bloque.id)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 text-left font-semibold transition-all duration-300 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{bloque.icon}</span>
                  <div>
                    <span className="text-lg">{bloque.titulo}</span>
                    <span className="ml-3 bg-white/20 px-2.5 py-0.5 rounded-full text-sm">
                      {bloque.count} temas
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform duration-300 ${expandedBlocks[bloque.id] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedBlocks[bloque.id] && (
              <div className="p-4 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                {bloque.temas.map((tema) => renderTema(tema))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer con acceso rápido a tests */}
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              ¿Prefieres practicar con tests?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pon a prueba tus conocimientos con preguntas de exámenes oficiales
            </p>
          </div>
          <Link
            href={`/${oposicion}/test`}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Ir a Tests
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  )
}
