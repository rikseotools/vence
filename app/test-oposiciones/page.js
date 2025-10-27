// app/test-oposiciones/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../lib/supabase'

const supabase = getSupabaseClient()

export default function TestOposicionesPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  // Leyes disponibles (hardcoded por ahora, se puede hacer dinámico después)
  const availableLaws = [
    {
      id: 'constitucion',
      title: 'Constitución Española de 1978',
      description: 'La norma suprema del ordenamiento jurídico español. Fundamental para cualquier oposición.',
      slug: 'constitucion-titulos',
      image: '🏛️',
      color: 'from-blue-600 to-indigo-700',
      sections: 11,
      articles: '1-169',
      priority: 1,
      tags: ['Fundamental', 'Constitucional', 'Básico']
    },
    {
      id: 'ley39',
      title: 'Ley 39/2015 - Procedimiento Administrativo Común (LPAC)',
      description: 'Ley esencial para oposiciones de Auxiliar Administrativo, AGE, Técnico Gestión, Administración Local, Justicia, Educación y Sanidad. Procedimiento administrativo común.',
      slug: 'test-ley-39-2015',
      image: '📋',
      color: 'from-emerald-600 to-teal-700',
      sections: 15,
      articles: '1-133',
      priority: 2,
      tags: ['LPAC', 'AGE', 'Administrativo', 'Local']
    }
  ]

  useEffect(() => {
    loadGeneralStats()
  }, [])

  const loadGeneralStats = async () => {
    try {
      // Obtener estadísticas generales de todas las leyes
      const { data: laws, error: lawsError } = await supabase
        .from('laws')
        .select('id, short_name, name')
        .in('short_name', ['CONST', 'LPAC'])

      if (lawsError) {
        console.error('Error cargando leyes:', lawsError)
        setStats({ totalLaws: 2, totalQuestions: 0, totalSections: 26 })
      } else {
        // Contar preguntas totales (aproximación)
        let totalQuestions = 0
        
        if (laws && laws.length > 0) {
          const { data: articles, error: articlesError } = await supabase
            .from('articles')
            .select('id')
            .in('law_id', laws.map(l => l.id))

          if (!articlesError && articles) {
            const { data: questions, error: questionsError } = await supabase
              .from('questions')
              .select('id')
              .in('primary_article_id', articles.map(a => a.id))
              .eq('is_active', true)

            if (!questionsError && questions) {
              totalQuestions = questions.length
            }
          }
        }

        setStats({
          totalLaws: availableLaws.length,
          totalQuestions,
          totalSections: 26, // 11 + 15
          totalArticles: laws?.length || 0
        })
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
      setStats({ totalLaws: 2, totalQuestions: 0, totalSections: 26 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 text-white py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-6xl md:text-8xl mb-4 md:mb-6">🎯</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6">
            Tests de Oposiciones
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-6 md:mb-8 max-w-3xl mx-auto">
            Prepárate para tus oposiciones con tests especializados por ley y materia. 
            Contenido actualizado, preguntas oficiales y seguimiento de progreso.
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8">
              <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
                <div className="text-xl md:text-3xl font-bold">{stats.totalLaws}</div>
                <div className="text-xs md:text-sm text-gray-200">Leyes</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
                <div className="text-xl md:text-3xl font-bold">{stats.totalSections}</div>
                <div className="text-xs md:text-sm text-gray-200">Secciones</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
                <div className="text-xl md:text-3xl font-bold">{stats.totalQuestions}</div>
                <div className="text-xs md:text-sm text-gray-200">Preguntas</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leyes Disponibles */}
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
            Leyes Disponibles
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            Cada ley está organizada por títulos y capítulos para un estudio más eficaz y dirigido
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
          {availableLaws.map((law) => (
            <Link
              key={law.id}
              href={`/test-oposiciones/${law.slug}`}
              className="group block"
            >
              <div className={`bg-gradient-to-r ${law.color} rounded-xl md:rounded-2xl p-4 md:p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl md:text-6xl group-hover:scale-110 transition-transform duration-300">
                    {law.image}
                  </div>
                  <div className="flex flex-wrap gap-1 md:gap-2">
                    {law.tags.slice(0, 2).map((tag) => (
                      <span 
                        key={tag}
                        className="bg-white/20 text-xs px-2 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                <h3 className="text-lg md:text-2xl font-bold mb-2 md:mb-3 group-hover:text-blue-100 transition-colors line-clamp-2">
                  {law.title}
                </h3>
                
                <p className="text-blue-100 mb-4 md:mb-5 leading-relaxed text-sm md:text-base line-clamp-3">
                  {law.description}
                </p>
                
                <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4">
                  <div className="bg-white/10 rounded-lg p-2 md:p-3 text-center">
                    <div className="text-lg md:text-xl font-bold">{law.sections}</div>
                    <div className="text-xs text-blue-100">Secciones</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 md:p-3 text-center">
                    <div className="text-lg md:text-xl font-bold">{law.articles}</div>
                    <div className="text-xs text-blue-100">Artículos</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-end">
                  <div className="flex items-center text-white group-hover:translate-x-2 transition-transform duration-300">
                    <span className="mr-2 text-sm md:text-base">Empezar Tests</span>
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Información Adicional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <div className="text-3xl md:text-4xl mb-3 md:mb-4">🎯</div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">
              Enfoque Especializado
            </h3>
            <p className="text-gray-600 text-sm">
              Cada test está diseñado específicamente para el contenido de cada ley, 
              con preguntas organizadas por títulos y capítulos.
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <div className="text-3xl md:text-4xl mb-3 md:mb-4">📊</div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">
              Seguimiento de Progreso
            </h3>
            <p className="text-gray-600 text-sm">
              Monitorea tu avance en cada sección, identifica áreas débiles 
              y mejora tu preparación de forma dirigida.
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <div className="text-3xl md:text-4xl mb-3 md:mb-4">✅</div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">
              Contenido Actualizado
            </h3>
            <p className="text-gray-600 text-sm">
              Preguntas basadas en exámenes oficiales y contenido actualizado 
              según las últimas reformas legislativas.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-900 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">
            ¿Listo para empezar tu preparación?
          </h2>
          <p className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8">
            Comienza con la Constitución Española, la base de todas las oposiciones
          </p>
          <Link
            href="/test-oposiciones/constitucion-titulos"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 md:px-8 rounded-lg text-base md:text-lg transition-colors duration-200"
          >
            🏛️ Empezar con la Constitución
            <svg className="w-4 h-4 md:w-5 md:h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}