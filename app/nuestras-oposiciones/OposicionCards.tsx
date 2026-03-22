// app/nuestras-oposiciones/OposicionCards.tsx
'use client'

import { useState, useEffect, type MouseEvent } from 'react'
import Link from 'next/link'
import { useOposicion } from '@/contexts/OposicionContext'

export interface CardData {
  id: string
  slug: string
  name: string
  emoji: string
  badge: string
  totalTopics: number
  blocksCount: number
  description: string
  level: string
  difficulty: string
  duration: string
  salary: string
  features: string[]
  requirements: string[]
  boeUrl: string | null
  comingSoon?: boolean
  plazasLibres: number | null
  isConvocatoriaActiva: boolean
}

function formatNumber(n: number | null): string {
  if (n == null) return ''
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function OposicionCards({ oposiciones }: { oposiciones: CardData[] }) {
  const { changeOposicion, hasOposicion, oposicionId } = useOposicion()
  const [selectedOposicion, setSelectedOposicion] = useState<CardData | null>(null)

  useEffect(() => {
    if (hasOposicion && oposicionId) {
      const found = oposiciones.find(op => op.id === oposicionId)
      setSelectedOposicion(found ?? null)
    }
  }, [hasOposicion, oposicionId, oposiciones])

  const handleCardClick = async (oposicion: CardData, event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a, button')) {
      return
    }
    await changeOposicion(oposicion.id)
    window.location.href = oposicion.comingSoon
      ? `/${oposicion.slug}/temario`
      : `/${oposicion.slug}`
  }

  return (
    <>
      {/* Oposicion actual */}
      {hasOposicion && selectedOposicion && (
        <div className="mb-12">
          <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6">
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-3xl">{selectedOposicion.emoji}</span>
              <div>
                <h2 className="text-xl font-bold text-emerald-800">Estudiando actualmente</h2>
                <p className="text-emerald-600">{selectedOposicion.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${selectedOposicion.slug}/temario`}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <span>📚</span><span>Ir al Temario</span>
              </Link>
              <Link
                href={`/${selectedOposicion.slug}/test`}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <span>🎯</span><span>Hacer Tests</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Oposiciones */}
      <div className="grid gap-8 max-w-4xl mx-auto">
        {oposiciones.map((oposicion) => (
          <div
            key={oposicion.id}
            onClick={(e) => handleCardClick(oposicion, e)}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border-2 cursor-pointer group border-gray-200 hover:border-blue-300 hover:shadow-blue-100"
          >
            {/* Header */}
            <div className={`${oposicion.comingSoon ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-slate-700 to-slate-800'} text-white p-6 relative overflow-hidden`}>
              {oposicion.comingSoon && (
                <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-xs font-medium">Proximamente</div>
              )}
              {oposicion.isConvocatoriaActiva && !oposicion.comingSoon && (
                <div className="absolute top-4 right-4 bg-emerald-500/80 px-3 py-1 rounded-full text-xs font-medium">Convocatoria activa</div>
              )}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center space-x-4">
                  <span className="text-4xl transform group-hover:scale-110 transition-transform duration-300">{oposicion.emoji}</span>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{oposicion.name}</h3>
                    <div className="flex items-center space-x-4 text-sm opacity-90">
                      <span className="bg-white/20 px-3 py-1 rounded-full">{oposicion.badge}</span>
                      <span>{oposicion.level}</span>
                      {oposicion.plazasLibres && (
                        <span className="bg-emerald-500/30 px-3 py-1 rounded-full font-medium">
                          {formatNumber(oposicion.plazasLibres)} plazas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">{oposicion.description}</p>

              {/* Estadisticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                  <div className="text-2xl font-bold text-slate-700">{oposicion.totalTopics}</div>
                  <div className="text-sm text-slate-600">Temas</div>
                </div>
                <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                  <div className="text-2xl font-bold text-slate-700">{oposicion.blocksCount}</div>
                  <div className="text-sm text-slate-600">Bloques</div>
                </div>
                <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                  <div className="text-lg font-bold text-slate-700">{oposicion.difficulty}</div>
                  <div className="text-sm text-slate-600">Dificultad</div>
                </div>
                <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                  <div className="text-lg font-bold text-slate-700">{oposicion.duration}</div>
                  <div className="text-sm text-slate-600">Duracion</div>
                </div>
              </div>

              {/* Caracteristicas */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">✨</span>Caracteristicas incluidas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {oposicion.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2 text-gray-600">
                      <span className="text-emerald-500">✓</span>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requisitos */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">📋</span>Requisitos basicos
                </h4>
                <div className="space-y-2">
                  {oposicion.requirements.map((req, index) => (
                    <div key={index} className="flex items-start space-x-2 text-gray-600">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-sm">{req}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                <Link
                  href={`/${oposicion.slug}/temario`}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>📚</span><span>Ver Temario</span>
                </Link>
                {oposicion.comingSoon ? (
                  <div
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-amber-100 text-amber-700 rounded-lg font-semibold cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>🕐</span><span>Tests proximamente</span>
                  </div>
                ) : (
                  <Link
                    href={`/${oposicion.slug}/test`}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>🎯</span><span>Hacer Tests</span>
                  </Link>
                )}
              </div>

              {/* Enlace BOE */}
              {oposicion.boeUrl && (
                <div className="mt-4 text-center">
                  <a
                    href={oposicion.boeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>📄</span>
                    <span>Ver convocatoria oficial</span>
                    <span>↗</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
