// lib/constitucionSSR.ts
// Funciones para SSR de la Constitución Española
//
// Migrado de supabase.from() (PostgREST) a Drizzle (2026-06-01, agnosticismo
// Fase 3). getReadDb() (read replica, role postgres → mismo bypass RLS que el
// service_role anterior) para lecturas SSR de contenido legal público.

import { and, count, eq, inArray } from 'drizzle-orm'
import { getReadDb } from '@/db/client'
import { articles, laws, lawSections, questions } from '@/db/schema'

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
  const db = getReadDb()

  try {
    // Obtener la Constitución Española
    const lawRows = await db
      .select({ id: laws.id })
      .from(laws)
      .where(eq(laws.shortName, 'CE'))
      .limit(1)
    const lawData = lawRows[0]

    if (!lawData) {
      console.error('Error cargando Constitución: no encontrada (short_name=CE)')
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Cargar secciones desde law_sections
    const sectionsData = await db
      .select()
      .from(lawSections)
      .where(and(eq(lawSections.lawId, lawData.id), eq(lawSections.isActive, true)))
      .orderBy(lawSections.orderPosition)

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
    const transformedSections: ConstitucionSection[] = sectionsData.map((section) => {
      const filesystemSlug = slugMapping[section.slug] || section.slug
      return {
        id: section.slug,
        title: section.title,
        description: section.description,
        slug: filesystemSlug,
        image: constitucionSectionIcons[filesystemSlug] || '📄',
        articles: section.articleRangeStart && section.articleRangeEnd
          ? { start: section.articleRangeStart, end: section.articleRangeEnd }
          : null,
        // section_number es columna text en BD; el interface lo tipa como
        // number|null (igual que antes con el cast de supabase). Preservamos
        // el valor runtime (string) tal cual lo devolvía PostgREST.
        sectionNumber: section.sectionNumber as unknown as number | null,
        sectionType: section.sectionType
      }
    })

    // Obtener estadísticas generales
    const articleRows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.lawId, lawData.id))

    let totalQuestions = 0

    if (articleRows.length > 0) {
      // count() agregado — el .length sobre el SELECT de supabase capaba a
      // 1000 filas (infra-conteo). count() da el total real sin cargar filas.
      const [{ value }] = await db
        .select({ value: count() })
        .from(questions)
        .where(and(
          inArray(questions.primaryArticleId, articleRows.map((a) => a.id)),
          eq(questions.isActive, true)
        ))
      totalQuestions = value
    }

    const stats: ConstitucionStats = {
      totalSections: sectionsData?.length || 0,
      totalQuestions,
      totalArticles: articleRows.length
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
  const db = getReadDb()

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
    const sectionRows = await db
      .select()
      .from(lawSections)
      .where(eq(lawSections.slug, dbSlug))
      .limit(1)
    const sectionData = sectionRows[0]

    if (!sectionData) {
      console.error('Error cargando sección: no encontrada slug=' + dbSlug)
      return null
    }

    // Configurar datos de la sección
    const config: SectionConfig = {
      title: sectionData.title,
      description: sectionData.description,
      lawId: sectionData.lawId,
      articleRange: sectionData.articleRangeStart && sectionData.articleRangeEnd
        ? { start: sectionData.articleRangeStart, end: sectionData.articleRangeEnd }
        : null,
      slug: sectionData.slug,
      sectionNumber: sectionData.sectionNumber as unknown as number | null,
      sectionType: sectionData.sectionType
    }

    // Obtener artículos específicos de esta sección
    const articleNumbers = Array.from(
      { length: config.articleRange!.end - config.articleRange!.start + 1 },
      (_, i) => String(config.articleRange!.start + i)
    )

    const articleRows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(
        eq(articles.lawId, config.lawId),
        inArray(articles.articleNumber, articleNumbers)
      ))

    // Contar preguntas de estos artículos
    let totalQuestions = 0

    if (articleRows.length > 0) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(questions)
        .where(and(
          inArray(questions.primaryArticleId, articleRows.map((a) => a.id)),
          eq(questions.isActive, true)
        ))
      totalQuestions = value
    }

    const stats: SectionStats = {
      questionsCount: totalQuestions,
      articlesCount: articleRows.length
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
