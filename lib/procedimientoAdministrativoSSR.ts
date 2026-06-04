// lib/procedimientoAdministrativoSSR.ts
// Funciones para SSR del Procedimiento Administrativo

// Migrado de supabase.from() (PostgREST) a Drizzle (2026-06-01, agnosticismo
// Fase 3). getReadDb() (read replica, role postgres → mismo bypass RLS que el
// service_role anterior) para lecturas SSR. Los joins propietarios
// content_scope→laws y content_sections→content_collections pasan a
// innerJoin/leftJoin explícitos de Drizzle.
import { cache } from 'react'
import { and, count, eq, ilike, inArray, or } from 'drizzle-orm'
import { getReadDb } from '@/db/client'
import {
  articles,
  contentCollections,
  contentScope,
  contentSections,
  laws,
  questions,
} from '@/db/schema'
import {
  getSectionMapping,
  getSectionStats,
  getProcedimientoLaws
} from './procedimientoAdministrativoMapping'

interface LawInfo {
  short_name: string
  name: string
}

interface ContentScopeLawMapping {
  description: string
  articles: string[]
}

interface ContentScopeMapping {
  laws: Record<string, ContentScopeLawMapping>
}

interface TransformedSection {
  id: string
  section_number: number | null
  name: string
  description: string | null
  slug: string
  icon: string | null
  articlesCount: number
  lawsCount: number
  hasMapping: boolean
}

interface ProcedimientoStats {
  totalSections: number
  totalQuestions: number
  totalArticles: number
  lawsUsed?: LawInfo[]
}

interface ProcedimientoData {
  sections: TransformedSection[]
  stats: ProcedimientoStats
}

interface SectionCollection {
  name: string
  slug: string
}

interface SectionConfig {
  name: string
  description: string | null
  slug: string
  section_number: number | null
  icon: string | null
  collection: SectionCollection
  mapping: ContentScopeMapping | { name: string; description: string; laws: Record<string, { articles: string[]; description: string }> } | null
  articles: string[]
  hasMapping: boolean
  usingContentScope: boolean
}

interface SectionStats {
  questionsCount: number
  articlesCount: number
  lawsCount: number
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

// Cargar datos del Procedimiento Administrativo para SSR.
// Envuelto en React cache() → dentro de una misma petición (p. ej. generateMetadata
// + el componente de página) se ejecuta UNA sola vez, no se duplica el trabajo a BD.
export const loadProcedimientoAdministrativoData = cache(_loadProcedimientoAdministrativoData)
async function _loadProcedimientoAdministrativoData(): Promise<ProcedimientoData> {
  const db = getReadDb()

  try {
    // Obtener la colección de Procedimiento Administrativo
    const collectionRows = await db
      .select({ id: contentCollections.id })
      .from(contentCollections)
      .where(eq(contentCollections.slug, 'procedimiento-administrativo'))
      .limit(1)
    const collectionData = collectionRows[0]

    if (!collectionData) {
      console.error('Error cargando colección: no encontrada (slug=procedimiento-administrativo)')
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Cargar secciones desde content_sections
    const sectionsData = await db
      .select()
      .from(contentSections)
      .where(and(eq(contentSections.collectionId, collectionData.id), eq(contentSections.isActive, true)))
      .orderBy(contentSections.orderPosition)

    // Transformar datos para la interfaz, enriqueciendo con mapeo real
    const transformedSections: TransformedSection[] = sectionsData.map((section) => {
      const mapping = getSectionMapping(section.slug)
      const sectionStats = getSectionStats(section.slug)

      return {
        id: section.id,
        section_number: section.sectionNumber,
        name: section.name,
        description: section.description,
        slug: section.slug,
        icon: section.icon,
        // Añadir estadísticas reales
        articlesCount: sectionStats.articlesCount,
        lawsCount: sectionStats.lawsCount,
        hasMapping: !!mapping
      }
    })

    // Calcular estadísticas reales basadas en el mapeo
    const totalArticles = transformedSections.reduce((total, section) => total + section.articlesCount, 0)
    const procedimientoLaws = getProcedimientoLaws()

    // Obtener count real de preguntas relacionadas con procedimiento administrativo
    let totalQuestions = 0

    // Obtener información de las leyes utilizadas en content_scope (JOIN laws)
    let lawsUsed: LawInfo[] = []
    try {
      const sectionIds = sectionsData.map((s) => s.id)
      const contentScopes = sectionIds.length
        ? await db
            .select({ shortName: laws.shortName, name: laws.name })
            .from(contentScope)
            .innerJoin(laws, eq(contentScope.lawId, laws.id))
            .where(inArray(contentScope.sectionId, sectionIds))
        : []

      // Obtener leyes únicas
      const uniqueLaws = contentScopes.reduce((acc: LawInfo[], scope) => {
        if (!acc.find((l) => l.short_name === scope.shortName)) {
          acc.push({ short_name: scope.shortName, name: scope.name })
        }
        return acc
      }, [] as LawInfo[])

      lawsUsed = uniqueLaws.sort((a, b) => a.short_name.localeCompare(b.short_name))

      // Buscar preguntas que mencionen las leyes de procedimiento administrativo.
      // count() agregado (el head:true de supabase ya contaba sin traer filas).
      const [{ value }] = await db
        .select({ value: count() })
        .from(questions)
        .where(and(
          or(
            ilike(questions.questionText, '%Ley 39/2015%'),
            ilike(questions.questionText, '%Ley 40/2015%'),
            ilike(questions.questionText, '%procedimiento administrativo%'),
            ilike(questions.questionText, '%acto administrativo%')
          ),
          eq(questions.isActive, true)
        ))
      totalQuestions = value
    } catch (error) {
      console.log('⚠️ Error calculando preguntas:', (error as Error).message)
    }

    const stats: ProcedimientoStats = {
      totalSections: sectionsData?.length || 0,
      totalQuestions,
      totalArticles,
      lawsUsed
    }

    return {
      sections: transformedSections,
      stats
    }

  } catch (error) {
    console.error('Error cargando datos del Procedimiento Administrativo:', error)
    return {
      sections: [],
      stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
    }
  }
}

// Cargar datos de una sección específica para SSR.
// Envuelto en React cache() → generateMetadata y el componente comparten una única
// resolución a BD por petición (antes se cargaba dos veces por página).
export const loadProcedimientoSectionData = cache(_loadProcedimientoSectionData)
async function _loadProcedimientoSectionData(sectionSlug: string): Promise<SectionData | null> {
  const db = getReadDb()

  try {
    // Cargar configuración de la sección desde content_sections (+ colección)
    const sectionRows = await db
      .select({
        id: contentSections.id,
        name: contentSections.name,
        description: contentSections.description,
        slug: contentSections.slug,
        sectionNumber: contentSections.sectionNumber,
        icon: contentSections.icon,
        collectionName: contentCollections.name,
        collectionSlug: contentCollections.slug,
      })
      .from(contentSections)
      .leftJoin(contentCollections, eq(contentSections.collectionId, contentCollections.id))
      .where(eq(contentSections.slug, sectionSlug))
      .limit(1)
    const sectionData = sectionRows[0]

    if (!sectionData) {
      console.error('Error cargando sección: no encontrada slug=' + sectionSlug)
      return null
    }

    // Obtener mapeo real desde content_scope en la base de datos
    let contentScopeMapping: ContentScopeMapping | null = null
    let hasContentScope = false

    // Cargar content_scope para esta sección (JOIN laws)
    const contentScopes = await db
      .select({
        lawId: contentScope.lawId,
        articleNumbers: contentScope.articleNumbers,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(contentScope)
      .innerJoin(laws, eq(contentScope.lawId, laws.id))
      .where(eq(contentScope.sectionId, sectionData.id))

    if (contentScopes.length > 0) {
      hasContentScope = true
      // Construir mapeo desde content_scope
      contentScopeMapping = {
        laws: {}
      }

      for (const scope of contentScopes) {
        const lawKey = scope.lawShortName
        if (!contentScopeMapping.laws[lawKey]) {
          contentScopeMapping.laws[lawKey] = {
            description: scope.lawName,
            articles: []
          }
        }
        // Añadir artículos únicos
        for (const articleNum of scope.articleNumbers) {
          if (!contentScopeMapping.laws[lawKey].articles.includes(articleNum)) {
            contentScopeMapping.laws[lawKey].articles.push(articleNum)
          }
        }
      }

      // Ordenar artículos numéricamente
      for (const lawKey in contentScopeMapping.laws) {
        contentScopeMapping.laws[lawKey].articles.sort((a: string, b: string) => parseInt(a) - parseInt(b))
      }
    }

    // Fallback al mapeo estático si no hay content_scope
    const fallbackMapping = getSectionMapping(sectionSlug)
    const finalMapping = contentScopeMapping || fallbackMapping

    // Configurar datos de la sección con mapeo real
    const config: SectionConfig = {
      name: sectionData.name,
      description: sectionData.description,
      slug: sectionData.slug,
      section_number: sectionData.sectionNumber,
      icon: sectionData.icon,
      collection: {
        name: sectionData.collectionName || 'Procedimiento Administrativo',
        slug: sectionData.collectionSlug || 'procedimiento-administrativo'
      },
      // Añadir información del mapeo
      mapping: finalMapping,
      articles: finalMapping ? Object.values(finalMapping.laws).flatMap((law: { articles: string[] }) => law.articles) : [],
      hasMapping: hasContentScope || !!fallbackMapping,
      usingContentScope: hasContentScope
    }

    // Calcular estadísticas reales
    let questionsCount = 0

    if (hasContentScope && contentScopes.length > 0) {
      try {
        // Resolución por CONJUNTOS (evita el patrón N+1: antes hacía 2 queries por
        // artículo → hasta decenas de round-trips secuenciales contra el pooler).
        // 1) Una query: todos los artículos de los pares (ley, [artículos]) del scope.
        const lawConds = contentScopes
          .filter((scope) => scope.articleNumbers && scope.articleNumbers.length > 0)
          .map((scope) => and(
            eq(articles.lawId, scope.lawId),
            inArray(articles.articleNumber, scope.articleNumbers)
          ))

        if (lawConds.length > 0) {
          const articleRows = await db
            .select({ id: articles.id })
            .from(articles)
            .where(lawConds.length === 1 ? lawConds[0] : or(...lawConds))
          const articleIds = articleRows.map((a) => a.id)

          // 2) Una query: count de preguntas activas vinculadas a esos artículos.
          if (articleIds.length > 0) {
            const [{ value }] = await db
              .select({ value: count() })
              .from(questions)
              .where(and(
                inArray(questions.primaryArticleId, articleIds),
                eq(questions.isActive, true)
              ))
            questionsCount = value
          }
        }
      } catch (error) {
        console.log('⚠️ Error calculando preguntas de sección:', (error as Error).message)
      }
    } else if (finalMapping) {
      try {
        // Fallback: buscar por contenido temático usando mapeo estático
        const [{ value }] = await db
          .select({ value: count() })
          .from(questions)
          .where(and(
            ilike(questions.questionText, '%Ley 39/2015%'),
            eq(questions.isActive, true)
          ))
        questionsCount = value
      } catch (error) {
        console.log('⚠️ Error calculando preguntas de sección (fallback):', (error as Error).message)
      }
    }

    // Calcular estadísticas reales basadas en content_scope o fallback
    let articlesCount = 0
    let lawsCount = 0

    if (hasContentScope && contentScopeMapping) {
      // Calcular desde content_scope real
      lawsCount = Object.keys(contentScopeMapping.laws).length
      articlesCount = Object.values(contentScopeMapping.laws).reduce((total: number, law: ContentScopeLawMapping) => total + law.articles.length, 0)
    } else {
      // Usar estadísticas del mapeo estático como fallback
      const sectionStatsData = getSectionStats(sectionSlug)
      articlesCount = sectionStatsData.articlesCount
      lawsCount = sectionStatsData.lawsCount
    }

    const stats: SectionStats = {
      questionsCount,
      articlesCount,
      lawsCount
    }

    return { config, stats }

  } catch (error) {
    console.error('Error cargando datos de la sección:', error)
    return null
  }
}


// Generar metadata dinámica para secciones
export function generateProcedimientoSectionMetadata(sectionConfig: { name: string; description: string | null; slug: string }): SectionMetadata {
  const baseTitle = `Test ${sectionConfig.name} - Procedimiento Administrativo`
  const baseDescription = `${sectionConfig.description}. `

  const oposicionesInfo = 'Oposiciones Auxiliar Administrativo, AGE, Técnico Gestión, Administración Local, Justicia.'

  return {
    title: baseTitle,
    description: `${baseDescription}${oposicionesInfo}`,
    keywords: `test procedimiento administrativo, ${sectionConfig.slug}, actos administrativos, recursos administrativos, oposiciones auxiliar administrativo`,
    openGraph: {
      title: baseTitle,
      description: `${baseDescription}Para oposiciones de Auxiliar Administrativo, AGE y más.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: baseTitle,
      description: `${baseDescription}Oposiciones AGE, Auxiliar Administrativo.`,
    },
  }
}
