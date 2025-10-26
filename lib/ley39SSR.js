// lib/ley39SSR.js
// Funciones para SSR de la Ley 39/2015

import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase para uso en servidor (usando service role key)
function getServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Mapeo de iconos para las secciones
export const sectionIcons = {
  'titulo-preliminar': '📜',
  'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado': '👤',
  'titulo-i-capitulo-ii-identificacion-firma-interesados': '✍️',
  'titulo-ii-capitulo-i-normas-generales-actuacion': '⚖️',
  'titulo-ii-capitulo-ii-terminos-plazos': '⏰',
  'titulo-iii-capitulo-i-requisitos-actos-administrativos': '📋',
  'titulo-iii-capitulo-ii-eficacia-actos': '✅',
  'titulo-iii-capitulo-iii-nulidad-anulabilidad': '❌',
  'titulo-iv-capitulos-i-ii-garantias-iniciacion': '🚀',
  'titulo-iv-capitulos-iii-iv-ordenacion-instruccion': '📊',
  'titulo-iv-capitulos-v-vi-vii-finalizacion-simplificada-ejecucion': '🏁',
  'titulo-v-capitulo-i-revision-oficio': '🔍',
  'titulo-v-capitulo-ii-recursos-administrativos': '🛡️',
  'titulo-vi-iniciativa-legislativa-potestad-reglamentaria': '📜',
  'test-plazos': '⏱️'
}

// Cargar datos de la ley 39/2015 para SSR
export async function loadLey39Data() {
  const supabase = getServerSupabaseClient()
  
  try {
    // Obtener la ley 39/2015 y sus secciones
    const { data: lawData, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single()

    if (lawError || !lawData) {
      console.error('Error cargando ley:', lawError)
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Cargar secciones desde law_sections
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('law_sections')
      .select('*')
      .eq('law_id', lawData.id)
      .eq('is_active', true)
      .order('order_position')

    if (sectionsError) {
      console.error('Error cargando secciones:', sectionsError)
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Transformar datos para la interfaz
    const transformedSections = sectionsData.map(section => ({
      id: section.slug,
      title: section.title,
      description: section.description,
      slug: section.slug,
      image: sectionIcons[section.slug] || '📄',
      articles: section.article_range_start && section.article_range_end 
        ? { start: section.article_range_start, end: section.article_range_end }
        : null
    }))

    // Obtener estadísticas generales
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', lawData.id)

    let totalQuestions = 0
    
    if (!articlesError && articles && articles.length > 0) {
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id')
        .in('primary_article_id', articles.map(a => a.id))
        .eq('is_active', true)

      if (!questionsError && questions) {
        totalQuestions = questions.length
      }
    }

    const stats = {
      totalSections: sectionsData?.length || 0,
      totalQuestions,
      totalArticles: articles?.length || 0
    }

    return {
      sections: transformedSections,
      stats
    }

  } catch (error) {
    console.error('Error cargando datos:', error)
    return {
      sections: [],
      stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
    }
  }
}

// Cargar datos de una sección específica para SSR
export async function loadSectionData(sectionSlug) {
  const supabase = getServerSupabaseClient()
  
  try {
    // Cargar configuración de la sección desde law_sections
    const { data: sectionData, error: sectionError } = await supabase
      .from('law_sections')
      .select('*')
      .eq('slug', sectionSlug)
      .single()

    if (sectionError || !sectionData) {
      console.error('Error cargando sección:', sectionError)
      return null
    }

    // Configurar datos de la sección
    const config = {
      title: sectionData.title,
      description: sectionData.description,
      lawId: sectionData.law_id,
      articleRange: sectionData.article_range_start && sectionData.article_range_end 
        ? { start: sectionData.article_range_start, end: sectionData.article_range_end }
        : null,
      slug: sectionData.slug
    }

    // Si no hay rango de artículos, es una sección especial
    if (!config.articleRange) {
      return {
        config,
        stats: { questionsCount: 0, articlesCount: 0 }
      }
    }

    // Obtener artículos específicos de esta sección
    const articleNumbers = Array.from(
      { length: config.articleRange.end - config.articleRange.start + 1 }, 
      (_, i) => String(config.articleRange.start + i)
    )
    
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', config.lawId)
      .in('article_number', articleNumbers)

    if (articlesError) {
      console.error('Error cargando artículos:', articlesError)
      return {
        config,
        stats: { questionsCount: 0, articlesCount: 0 }
      }
    }

    // Contar preguntas de estos artículos
    let totalQuestions = 0
    
    if (articles && articles.length > 0) {
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id')
        .in('primary_article_id', articles.map(a => a.id))
        .eq('is_active', true)

      if (!questionsError && questions) {
        totalQuestions = questions.length
      }
    }

    const stats = {
      questionsCount: totalQuestions,
      articlesCount: articles?.length || 0
    }

    return { config, stats }

  } catch (error) {
    console.error('Error cargando datos de la sección:', error)
    return null
  }
}

// Generar metadata dinámica para secciones
export function generateSectionMetadata(sectionConfig) {
  const baseTitle = `Test ${sectionConfig.title} - Ley 39/2015 LPAC`
  const baseDescription = `${sectionConfig.description}. `
  
  let articleInfo = ''
  if (sectionConfig.articleRange) {
    articleInfo = `Artículos ${sectionConfig.articleRange.start}-${sectionConfig.articleRange.end}. `
  }
  
  const oposicionesInfo = 'Oposiciones Auxiliar Administrativo, AGE, Técnico Gestión, Administración Local, Justicia.'
  
  return {
    title: baseTitle,
    description: `${baseDescription}${articleInfo}${oposicionesInfo}`,
    keywords: `test ley 39/2015, ${sectionConfig.slug}, LPAC, procedimiento administrativo común, oposiciones auxiliar administrativo, ${sectionConfig.articleRange ? `artículos ${sectionConfig.articleRange.start}-${sectionConfig.articleRange.end}` : 'test especializado'}`,
    openGraph: {
      title: baseTitle,
      description: `${baseDescription}${articleInfo}Para oposiciones de Auxiliar Administrativo, AGE y más.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: baseTitle,
      description: `${baseDescription}${articleInfo}Oposiciones AGE, Auxiliar Administrativo.`,
    },
  }
}