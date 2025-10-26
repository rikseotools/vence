// lib/constitucionSSR.js
// Funciones para SSR de la Constitución Española

import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase para uso en servidor (usando service role key)
function getServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Mapeo de iconos para las secciones de la Constitución
export const constitucionSectionIcons = {
  'preambulo-y-titulo-preliminar': '📜',
  'titulo-i-derechos-y-deberes-fundamentales': '⚖️',
  'titulo-ii-de-la-corona': '👑',
  'titulo-iii-de-las-cortes-generales': '🏛️',
  'titulo-iv-del-gobierno-y-la-administracion': '🏢',
  'titulo-v-relaciones-gobierno-cortes': '🤝',
  'titulo-vi-del-poder-judicial': '⚖️',
  'titulo-vii-economia-y-hacienda': '💰',
  'titulo-viii-organizacion-territorial': '🗺️',
  'titulo-ix-del-tribunal-constitucional': '🏛️',
  'titulo-x-de-la-reforma-constitucional': '📖'
}

// Cargar datos de la Constitución Española para SSR
export async function loadConstitucionData() {
  const supabase = getServerSupabaseClient()
  
  try {
    // Obtener la Constitución Española
    const { data: lawData, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'CE')
      .single()

    if (lawError || !lawData) {
      console.error('Error cargando Constitución:', lawError)
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
      image: constitucionSectionIcons[section.slug] || '📄',
      articles: section.article_range_start && section.article_range_end 
        ? { start: section.article_range_start, end: section.article_range_end }
        : null,
      // Información adicional específica de la Constitución
      sectionNumber: section.section_number,
      sectionType: section.section_type
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
    console.error('Error cargando datos de la Constitución:', error)
    return {
      sections: [],
      stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
    }
  }
}

// Cargar datos de una sección específica para SSR
export async function loadConstitucionSectionData(sectionSlug) {
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
      slug: sectionData.slug,
      sectionNumber: sectionData.section_number,
      sectionType: sectionData.section_type
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

// Generar metadata dinámica para secciones de la Constitución
export function generateConstitucionSectionMetadata(sectionConfig) {
  const baseTitle = `Test ${sectionConfig.title} - Constitución Española 1978`
  const baseDescription = `${sectionConfig.description}. `
  
  let articleInfo = ''
  if (sectionConfig.articleRange) {
    articleInfo = `Artículos ${sectionConfig.articleRange.start}-${sectionConfig.articleRange.end}. `
  }
  
  const oposicionesInfo = 'Oposiciones Auxiliar Administrativo, AGE, Justicia, Correos, Sanidad y más.'
  
  return {
    title: baseTitle,
    description: `${baseDescription}${articleInfo}${oposicionesInfo}`,
    keywords: `test constitución española, ${sectionConfig.slug}, constitución 1978, oposiciones auxiliar administrativo, ${sectionConfig.articleRange ? `artículos ${sectionConfig.articleRange.start}-${sectionConfig.articleRange.end}` : 'test especializado'}`,
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