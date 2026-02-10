'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function TestPersonalizadoContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contentScopeConfig, setContentScopeConfig] = useState(null)
  
  // Obtener parámetro de sección para content_scope
  const seccionSlug = searchParams.get('seccion')
  
  useEffect(() => {
    async function loadContentScopeConfig() {
      if (!seccionSlug) {
        setError('No se especificó una sección')
        setLoading(false)
        return
      }

      try {
        console.log('🔍 Cargando configuración content_scope para:', seccionSlug)
        
        // 1. Obtener información de la sección
        const { data: section, error: sectionError } = await getSupabase()
          .from('content_sections')
          .select(`
            id,
            name,
            slug,
            description,
            icon,
            content_collections (
              name,
              slug
            )
          `)
          .eq('slug', seccionSlug)
          .single()

        if (sectionError || !section) {
          throw new Error(`Sección "${seccionSlug}" no encontrada`)
        }

        // 2. Obtener content_scope para esta sección
        const { data: contentScopes, error: scopeError } = await getSupabase()
          .from('content_scope')
          .select('law_id, article_numbers')
          .eq('section_id', section.id)

        if (scopeError) {
          throw new Error(`Error cargando content_scope: ${scopeError.message}`)
        }

        // 3. Obtener IDs de artículos específicos
        const articleIds = []
        
        for (const scope of contentScopes) {
          for (const articleNumber of scope.article_numbers) {
            const { data: article } = await getSupabase()
              .from('articles')
              .select('id')
              .eq('law_id', scope.law_id)
              .eq('article_number', articleNumber)
              .single()
            
            if (article) {
              articleIds.push(article.id)
            }
          }
        }

        console.log('📋 Artículos encontrados:', articleIds.length)

        const config = {
          sectionInfo: section,
          articleIds,
          contentScopes,
          questionsMode: 'content_scope'
        }

        setContentScopeConfig(config)
        setLoading(false)

      } catch (error) {
        console.error('❌ Error:', error.message)
        setError(error.message)
        setLoading(false)
      }
    }

    loadContentScopeConfig()
  }, [seccionSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test de {seccionSlug}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Error
          </h1>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <a 
            href="/test-oposiciones/procedimiento-administrativo"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            ← Volver a Procedimiento Administrativo
          </a>
        </div>
      </div>
    )
  }

  return (
    <TestPageWrapper
      testType="content_scope"
      contentScopeConfig={contentScopeConfig}
      customTitle={`Test ${contentScopeConfig.sectionInfo.name}`}
      customDescription={contentScopeConfig.sectionInfo.description}
      customSubtitle={`${contentScopeConfig.sectionInfo.content_collections.name}`}
      customIcon={contentScopeConfig.sectionInfo.icon || "📋"}
      customColor="from-emerald-500 to-teal-600"
    />
  )
}

export default function TestPersonalizadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent />
    </Suspense>
  )
}