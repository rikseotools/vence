// lib/ley39SSR.ts
// Funciones para SSR de la Ley 39/2015
//
// Migrado de supabase.from() (PostgREST) a Drizzle (2026-06-01, agnosticismo
// Fase 3). getReadDb() ofrece la read replica para descargar la primaria en
// SSR y, con role postgres, mantiene el mismo bypass de RLS que tenía el
// service_role anterior. Lecturas de contenido legal público: bajo riesgo.

import { and, count, eq, inArray } from 'drizzle-orm'
import { getReadDb } from '@/db/client'
import { articles, laws, lawSections, questions } from '@/db/schema'

interface ArticleRange {
  start: number
  end: number
}

interface Ley39Section {
  id: string
  title: string
  description: string | null
  slug: string
  image: string
  articles: ArticleRange | null
}

interface Ley39Stats {
  totalSections: number
  totalQuestions: number
  totalArticles: number
}

interface Ley39Data {
  sections: Ley39Section[]
  stats: Ley39Stats
}

interface SectionConfig {
  title: string
  description: string | null
  lawId: string
  articleRange: ArticleRange | null
  slug: string
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

// Mapeo de iconos para las secciones
export const sectionIcons: Record<string, string> = {
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
export async function loadLey39Data(): Promise<Ley39Data> {
  const db = getReadDb()

  try {
    // Obtener la ley 39/2015 y sus secciones
    const lawRows = await db
      .select({ id: laws.id })
      .from(laws)
      .where(eq(laws.shortName, 'Ley 39/2015'))
      .limit(1)
    const lawData = lawRows[0]

    if (!lawData) {
      console.error('Error cargando ley: no encontrada (short_name=Ley 39/2015)')
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
      'titulo-preliminar-disposiciones-generales': 'titulo-preliminar',
      'titulo-i-interesados-procedimiento': 'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado',
      'titulo-ii-actividad-administraciones-publicas': 'titulo-ii-capitulo-i-normas-generales-actuacion',
      'titulo-iii-actos-administrativos': 'titulo-iii-capitulo-i-requisitos-actos-administrativos',
      'titulo-iv-procedimiento-administrativo-comun': 'titulo-iv-capitulos-i-ii-garantias-iniciacion',
      'titulo-v-revision-actos-via-administrativa': 'titulo-v-capitulo-i-revision-oficio',
      'titulo-vi-iniciativa-legislativa-potestad-reglamentaria': 'titulo-vi-iniciativa-legislativa-potestad-reglamentaria'
    }

    // Transformar datos para la interfaz
    const transformedSections: Ley39Section[] = sectionsData.map((section) => {
      const filesystemSlug = slugMapping[section.slug] || section.slug
      return {
        id: section.slug,
        title: section.title,
        description: section.description,
        slug: filesystemSlug,
        image: sectionIcons[filesystemSlug] || '📄',
        articles: section.articleRangeStart && section.articleRangeEnd
          ? { start: section.articleRangeStart, end: section.articleRangeEnd }
          : null
      }
    })

    // Obtener estadísticas generales
    const articleRows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.lawId, lawData.id))

    let totalQuestions = 0

    if (articleRows.length > 0) {
      // count() agregado: el código supabase anterior usaba .length sobre el
      // SELECT, que PostgREST capaba a 1000 filas → infra-contaba (mostraba
      // 1000 cuando hay 2779). count() da el total real y no carga las filas.
      const [{ value }] = await db
        .select({ value: count() })
        .from(questions)
        .where(and(
          inArray(questions.primaryArticleId, articleRows.map((a) => a.id)),
          eq(questions.isActive, true)
        ))
      totalQuestions = value
    }

    const stats: Ley39Stats = {
      totalSections: sectionsData?.length || 0,
      totalQuestions,
      totalArticles: articleRows.length
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
export async function loadSectionData(sectionSlug: string): Promise<SectionData | null> {
  const db = getReadDb()

  try {
    // Mapeo inverso: de filesystem slug a BD slug
    const inverseBDMapping: Record<string, string> = {
      'titulo-preliminar': 'titulo-preliminar-disposiciones-generales',
      'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado': 'titulo-i-interesados-procedimiento',
      'titulo-i-capitulo-ii-identificacion-firma-interesados': 'titulo-i-interesados-procedimiento',
      'titulo-ii-capitulo-i-normas-generales-actuacion': 'titulo-ii-actividad-administraciones-publicas',
      'titulo-ii-capitulo-ii-terminos-plazos': 'titulo-ii-actividad-administraciones-publicas',
      'titulo-iii-capitulo-i-requisitos-actos-administrativos': 'titulo-iii-actos-administrativos',
      'titulo-iii-capitulo-ii-eficacia-actos': 'titulo-iii-actos-administrativos',
      'titulo-iii-capitulo-iii-nulidad-anulabilidad': 'titulo-iii-actos-administrativos',
      'titulo-iv-capitulos-i-ii-garantias-iniciacion': 'titulo-iv-procedimiento-administrativo-comun',
      'titulo-iv-capitulos-iii-iv-ordenacion-instruccion': 'titulo-iv-procedimiento-administrativo-comun',
      'titulo-iv-capitulos-v-vi-vii-finalizacion-simplificada-ejecucion': 'titulo-iv-procedimiento-administrativo-comun',
      'titulo-v-capitulo-i-revision-oficio': 'titulo-v-revision-actos-via-administrativa',
      'titulo-v-capitulo-ii-recursos-administrativos': 'titulo-v-revision-actos-via-administrativa',
      'titulo-vi-iniciativa-legislativa-potestad-reglamentaria': 'titulo-vi-iniciativa-legislativa-potestad-reglamentaria',
      'test-plazos': 'test-plazos'
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
      // count() agregado: el código supabase anterior usaba .length sobre el
      // SELECT, que PostgREST capaba a 1000 filas → infra-contaba (mostraba
      // 1000 cuando hay 2779). count() da el total real y no carga las filas.
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

// Generar metadata dinámica para secciones
export function generateSectionMetadata(sectionConfig: SectionConfig): SectionMetadata {
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
