// lib/constitucionSSR.ts
// Funciones para SSR de la Constitución Española

import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

interface ArticleRange {
  start: number
  end: number
}

interface ConstitucionSection {
  id: string
  title: string
  description: string | null
  slug: string
  image: string
  articles: ArticleRange | null
  sectionNumber: number | null
  sectionType: string | null
}

interface ConstitucionStats {
  totalSections: number
  totalQuestions: number
  totalArticles: number
}

interface ConstitucionData {
  sections: ConstitucionSection[]
  stats: ConstitucionStats
}

interface SectionConfig {
  title: string
  description: string | null
  lawId: string
  articleRange: ArticleRange | null
  slug: string
  sectionNumber: number | null
  sectionType: string | null
}

interface SectionStats {
  questionsCount: number
  articlesCount: number
}

interface SectionData {
  config: SectionConfig
  stats: SectionStats
}

interface SectionMetadata {
  title: string
  description: string
  keywords: string
  openGraph: {
    title: string
    description: string
    type: string
  }
  twitter: {
    card: string
    title: string
    description: string
  }
}

// Cliente de Supabase para uso en servidor (usando service role key)
function getServerSupabaseClient(): SupabaseClientAny {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mapeo de iconos para las secciones de la Constitución
export const constitucionSectionIcons: Record<string, string> = {
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
export async function loadConstitucionData(): Promise<ConstitucionData> {
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

    // Mapeo de slugs BD a slugs filesystem
    const slugMapping: Record<string, string> = {
      'titulo-preliminar': 'preambulo-y-titulo-preliminar',
      'titulo-i-derechos-deberes-fundamentales': 'titulo-i-derechos-y-deberes-fundamentales',
      'titulo-ii-corona': 'titulo-ii-de-la-corona',
      'titulo-iii-cortes-generales': 'titulo-iii-de-las-cortes-generales',
      'titulo-iv-gobierno-administracion': 'titulo-iv-del-gobierno-y-la-administracion',
      'titulo-v-relaciones-gobierno-cortes': 'titulo-v-relaciones-gobierno-cortes',
      'titulo-vi-poder-judicial': 'titulo-vi-del-poder-judicial',
      'titulo-vii-economia-hacienda': 'titulo-vii-economia-y-hacienda',
      'titulo-viii-organizacion-territorial': 'titulo-viii-organizacion-territorial',
      'titulo-ix-tribunal-constitucional': 'titulo-ix-del-tribunal-constitucional',
      'titulo-x-reforma-constitucional': 'titulo-x-de-la-reforma-constitucional'
    }

    // Transformar datos para la interfaz
    const transformedSections: ConstitucionSection[] = sectionsData.map((section: Record<string, unknown>) => {
      const filesystemSlug = slugMapping[section.slug as string] || section.slug as string
      return {
        id: section.slug as string,
        title: section.title as string,
        description: section.description as string | null,
        slug: filesystemSlug,
        image: constitucionSectionIcons[filesystemSlug] || '📄',
        articles: section.article_range_start && section.article_range_end
          ? { start: section.article_range_start as number, end: section.article_range_end as number }
          : null,
        sectionNumber: section.section_number as number | null,
        sectionType: section.section_type as string | null
      }
    })

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
        .in('primary_article_id', articles.map((a: { id: string }) => a.id))
        .eq('is_active', true)

      if (!questionsError && questions) {
        totalQuestions = questions.length
      }
    }

    const stats: ConstitucionStats = {
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
export async function loadConstitucionSectionData(sectionSlug: string): Promise<SectionData | null> {
  const supabase = getServerSupabaseClient()

  try {
    // Mapeo inverso: de filesystem slug a BD slug
    const inverseBDMapping: Record<string, string> = {
      'preambulo-y-titulo-preliminar': 'titulo-preliminar',
      'titulo-i-derechos-y-deberes-fundamentales': 'titulo-i-derechos-deberes-fundamentales',
      'titulo-ii-de-la-corona': 'titulo-ii-corona',
      'titulo-iii-de-las-cortes-generales': 'titulo-iii-cortes-generales',
      'titulo-iv-del-gobierno-y-la-administracion': 'titulo-iv-gobierno-administracion',
      'titulo-v-relaciones-gobierno-cortes': 'titulo-v-relaciones-gobierno-cortes',
      'titulo-vi-del-poder-judicial': 'titulo-vi-poder-judicial',
      'titulo-vii-economia-y-hacienda': 'titulo-vii-economia-hacienda',
      'titulo-viii-organizacion-territorial': 'titulo-viii-organizacion-territorial',
      'titulo-ix-del-tribunal-constitucional': 'titulo-ix-tribunal-constitucional',
      'titulo-x-de-la-reforma-constitucional': 'titulo-x-reforma-constitucional'
    }

    // Convertir filesystem slug a BD slug
    const dbSlug = inverseBDMapping[sectionSlug] || sectionSlug

    // Cargar configuración de la sección desde law_sections
    const { data: sectionData, error: sectionError } = await supabase
      .from('law_sections')
      .select('*')
      .eq('slug', dbSlug)
      .single()

    if (sectionError || !sectionData) {
      console.error('Error cargando sección:', sectionError)
      return null
    }

    // Configurar datos de la sección
    const config: SectionConfig = {
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
      { length: config.articleRange!.end - config.articleRange!.start + 1 },
      (_, i) => String(config.articleRange!.start + i)
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
        .in('primary_article_id', articles.map((a: { id: string }) => a.id))
        .eq('is_active', true)

      if (!questionsError && questions) {
        totalQuestions = questions.length
      }
    }

    const stats: SectionStats = {
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
export function generateConstitucionSectionMetadata(sectionConfig: SectionConfig): SectionMetadata {
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
