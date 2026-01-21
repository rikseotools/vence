'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

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
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    grupo1: true,
    grupo2: false,
    grupo3: false,
    grupo4: false,
    grupo5: false
  })

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
  }

  const renderTema = (tema: Tema) => {
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
        className="group block p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center gap-4">
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
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0"
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
                <span className="font-semibold text-gray-900 dark:text-white">Recibe avisos.</span>{' '}
                Regístrate para ser notificado cuando el contenido esté disponible.
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
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-4 px-6 text-left font-semibold transition-all duration-300 focus:outline-none"
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

      {/* Footer con info del examen */}
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Estructura del examen
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Primera parte</p>
            <p className="font-semibold text-gray-900 dark:text-white">50 preguntas</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Grupos I-IV</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Segunda parte</p>
            <p className="font-semibold text-gray-900 dark:text-white">30 preguntas</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Grupo V (Ofimática)</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Tercera parte</p>
            <p className="font-semibold text-gray-900 dark:text-white">20 preguntas</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Supuesto práctico</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Penalización: 1/4 por respuesta incorrecta. Aprobado: 50/100 puntos.
        </p>
      </div>
    </>
  )
}
