// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../lib/supabase'

const supabase = getSupabaseClient()

export default function TestConstitucionPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  // Estructura de la Constitución Española (hardcodeada por ahora)
  const constitucionSections = [
    {
      id: 'caracteristicas',
      title: 'LA CONSTITUCIÓN ESPAÑOLA DE 1978. CARACTERÍSTICAS GENERALES.',
      description: 'Características generales de la Constitución Española de 1978',
      slug: 'caracteristicas-generales',
      image: '🏛️',
      articles: null
    },
    {
      id: 'estructura',
      title: 'LA CONSTITUCIÓN ESPAÑOLA DE 1978. ESTRUCTURA.',
      description: 'Estructura general de la Constitución Española',
      slug: 'estructura',
      image: '📋',
      articles: null
    },
    {
      id: 'preambulo',
      title: 'PREÁMBULO Y TÍTULO PRELIMINAR.',
      description: 'Preámbulo y Título Preliminar de la Constitución',
      slug: 'preambulo-y-titulo-preliminar',
      image: '📜',
      articles: { start: 1, end: 9 }
    },
    {
      id: 'titulo-i',
      title: 'Título I. De los Derechos y deberes fundamentales.',
      description: 'Derechos y deberes fundamentales',
      slug: 'titulo-i-derechos-y-deberes-fundamentales',
      image: '⚖️',
      articles: { start: 10, end: 55 },
      chapters: [
        'Capítulo 1º. De los españoles y los extranjeros.',
        'Capítulo 2º. Derechos y libertades.',
        'Capítulo 3º. De los principios rectores de la política social y económica.',
        'Capítulo 4º. De las garantías de las libertades y derechos fundamentales.',
        'Capítulo 5º. De la suspensión de los derechos y libertades.'
      ]
    },
    {
      id: 'titulo-ii',
      title: 'Título II. De la Corona.',
      description: 'La Corona española',
      slug: 'titulo-ii-de-la-corona',
      image: '👑',
      articles: { start: 56, end: 65 }
    },
    {
      id: 'titulo-iii',
      title: 'Título III. De las Cortes Generales.',
      description: 'Las Cortes Generales',
      slug: 'titulo-iii-de-las-cortes-generales',
      image: '🏛️',
      articles: { start: 66, end: 96 },
      chapters: [
        'Capítulo 1º. De las Cámaras.',
        'Capítulo 2º. De la elaboración de las leyes.',
        'Capítulo 3º. De los Tratados Internacionales.'
      ]
    },
    {
      id: 'titulo-iv',
      title: 'Título IV. Del Gobierno y de la Administración.',
      description: 'El Gobierno y la Administración',
      slug: 'titulo-iv-del-gobierno-y-la-administracion',
      image: '🏢',
      articles: { start: 97, end: 107 }
    },
    {
      id: 'titulo-v',
      title: 'Título V. De las relaciones entre el Gobierno y las Cortes Generales.',
      description: 'Relaciones entre el Gobierno y las Cortes',
      slug: 'titulo-v-relaciones-gobierno-cortes',
      image: '🤝',
      articles: { start: 108, end: 116 }
    },
    {
      id: 'titulo-vi',
      title: 'Título VI. Del Poder Judicial.',
      description: 'El Poder Judicial',
      slug: 'titulo-vi-del-poder-judicial',
      image: '⚖️',
      articles: { start: 117, end: 127 }
    },
    {
      id: 'titulo-vii',
      title: 'Título VII. Economía y hacienda.',
      description: 'Economía y Hacienda',
      slug: 'titulo-vii-economia-y-hacienda',
      image: '💰',
      articles: { start: 128, end: 136 }
    },
    {
      id: 'titulo-viii',
      title: 'TÍTULO VIII. De la organización territorial del Estado.',
      description: 'Organización territorial del Estado',
      slug: 'titulo-viii-organizacion-territorial',
      image: '🗺️',
      articles: { start: 137, end: 158 },
      chapters: [
        'Capítulo 1º. Principios generales.',
        'Capítulo 2º. De la Administración local.',
        'Capítulo 3º. De las Comunidades Autónomas.'
      ]
    },
    {
      id: 'titulo-ix',
      title: 'Título IX. Del Tribunal Constitucional.',
      description: 'El Tribunal Constitucional',
      slug: 'titulo-ix-del-tribunal-constitucional',
      image: '🏛️',
      articles: { start: 159, end: 165 }
    },
    {
      id: 'titulo-x',
      title: 'Título X. De la reforma constitucional.',
      description: 'Reforma de la Constitución',
      slug: 'titulo-x-de-la-reforma-constitucional',
      image: '📖',
      articles: { start: 166, end: 169 }
    },
    {
      id: 'disposiciones',
      title: 'Disposiciones adicionales, transitorias, derogatoria y final.',
      description: 'Disposiciones adicionales y finales',
      slug: 'disposiciones-adicionales-transitorias-final',
      image: '📄',
      articles: null
    }
  ]

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Aquí cargaríamos estadísticas reales de la BD
      setStats({
        totalQuestions: 450,
        totalSections: constitucionSections.length
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ SEO Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">
            TEST SOBRE LA CONSTITUCIÓN ESPAÑOLA DE 1978
          </h1>
          <p className="text-blue-100 text-center text-lg mb-6">
            Preparación de oposiciones para Administrativos, Estado, Justicia, Sanidad, Correos, etc.
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8 text-center">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.totalSections}</div>
                <div className="text-sm text-blue-100">Secciones</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.totalQuestions}+</div>
                <div className="text-sm text-blue-100">Preguntas</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Secciones de Tests */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {constitucionSections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/test-de-la-constitucion-espanola-de-1978/${section.slug}`}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group"
            >
              <div className="relative">
                {/* Icono/Imagen */}
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 h-24 flex items-center justify-center">
                  <div className="text-white text-4xl">
                    {section.image}
                  </div>
                  <div className="absolute top-2 right-2 bg-white/20 rounded-full p-2">
                    <div className="text-white text-lg">💡</div>
                  </div>
                </div>
                
                {/* Contenido */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2">
                    {section.title}
                  </h3>
                  
                  {section.articles && (
                    <p className="text-gray-600 text-xs mb-2">
                      Art. {section.articles.start} - {section.articles.end}
                    </p>
                  )}
                  
                  {section.chapters && (
                    <div className="text-gray-500 text-xs space-y-1">
                      {section.chapters.slice(0, 2).map((chapter, idx) => (
                        <div key={idx} className="italic">
                          {chapter}
                        </div>
                      ))}
                      {section.chapters.length > 2 && (
                        <div className="text-gray-400">
                          +{section.chapters.length - 2} capítulos más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ✅ Footer con Enlaces de Navegación */}
      <div className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Más Tests de Oposiciones
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/auxiliar-administrativo-estado/test"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Tests Auxiliar Administrativo del Estado
            </Link>
            <Link
              href="/test-oposiciones"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Todos los Tests de Oposiciones
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}