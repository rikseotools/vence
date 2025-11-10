// lib/procedimientoAdministrativoSSR.js
// Funciones para SSR del Procedimiento Administrativo

import { createClient } from '@supabase/supabase-js'
import { 
  PROCEDIMIENTO_MAPPING, 
  getSectionMapping, 
  getSectionArticles, 
  getSectionStats,
  getProcedimientoLaws 
} from './procedimientoAdministrativoMapping.js'

// Cliente de Supabase para uso en servidor (usando service role key)
function getServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Cargar datos del Procedimiento Administrativo para SSR
export async function loadProcedimientoAdministrativoData() {
  const supabase = getServerSupabaseClient()
  
  try {
    // Obtener la colección de Procedimiento Administrativo
    const { data: collectionData, error: collectionError } = await supabase
      .from('content_collections')
      .select('id, name, description')
      .eq('slug', 'procedimiento-administrativo')
      .single()

    if (collectionError || !collectionData) {
      console.error('Error cargando colección:', collectionError)
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Cargar secciones desde content_sections
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('content_sections')
      .select('*')
      .eq('collection_id', collectionData.id)
      .eq('is_active', true)
      .order('order_position')

    if (sectionsError) {
      console.error('Error cargando secciones:', sectionsError)
      return {
        sections: [],
        stats: { totalSections: 0, totalQuestions: 0, totalArticles: 0 }
      }
    }

    // Transformar datos para la interfaz, enriqueciendo con mapeo real
    const transformedSections = sectionsData.map(section => {
      const mapping = getSectionMapping(section.slug)
      const sectionStats = getSectionStats(section.slug)
      
      return {
        id: section.id,
        section_number: section.section_number,
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
    
    // Obtener información de las leyes utilizadas en content_scope
    let lawsUsed = []
    try {
      const { data: contentScopes } = await supabase
        .from('content_scope')
        .select(`
          law_id,
          laws!inner (
            short_name,
            name
          )
        `)
        .in('section_id', sectionsData.map(s => s.id))
      
      if (contentScopes) {
        // Obtener leyes únicas
        const uniqueLaws = contentScopes.reduce((acc, scope) => {
          if (!acc.find(l => l.short_name === scope.laws.short_name)) {
            acc.push({
              short_name: scope.laws.short_name,
              name: scope.laws.name
            })
          }
          return acc
        }, [])
        
        lawsUsed = uniqueLaws.sort((a, b) => a.short_name.localeCompare(b.short_name))
      }

      // Buscar preguntas que mencionen las leyes de procedimiento administrativo
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .or('question_text.ilike.%Ley 39/2015%,question_text.ilike.%Ley 40/2015%,question_text.ilike.%procedimiento administrativo%,question_text.ilike.%acto administrativo%')
        .eq('is_active', true)
      
      totalQuestions = count || 0
    } catch (error) {
      console.log('⚠️ Error calculando preguntas:', error.message)
    }

    const stats = {
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

// Cargar datos de una sección específica para SSR
export async function loadProcedimientoSectionData(sectionSlug) {
  const supabase = getServerSupabaseClient()
  
  try {
    // Cargar configuración de la sección desde content_sections
    const { data: sectionData, error: sectionError } = await supabase
      .from('content_sections')
      .select(`
        *,
        content_collections (
          name,
          slug,
          description
        )
      `)
      .eq('slug', sectionSlug)
      .single()

    if (sectionError || !sectionData) {
      console.error('Error cargando sección:', sectionError)
      return null
    }

    // Obtener mapeo real desde content_scope en la base de datos
    let contentScopeMapping = null
    let hasContentScope = false
    
    // Cargar content_scope para esta sección
    const { data: contentScopes } = await supabase
      .from('content_scope')
      .select(`
        law_id, 
        article_numbers,
        laws!inner (
          short_name,
          name
        )
      `)
      .eq('section_id', sectionData.id)

    if (contentScopes && contentScopes.length > 0) {
      hasContentScope = true
      // Construir mapeo desde content_scope
      contentScopeMapping = {
        laws: {}
      }
      
      for (const scope of contentScopes) {
        const lawKey = scope.laws.short_name
        if (!contentScopeMapping.laws[lawKey]) {
          contentScopeMapping.laws[lawKey] = {
            description: scope.laws.name,
            articles: []
          }
        }
        // Añadir artículos únicos
        for (const articleNum of scope.article_numbers) {
          if (!contentScopeMapping.laws[lawKey].articles.includes(articleNum)) {
            contentScopeMapping.laws[lawKey].articles.push(articleNum)
          }
        }
      }
      
      // Ordenar artículos numéricamente
      for (const lawKey in contentScopeMapping.laws) {
        contentScopeMapping.laws[lawKey].articles.sort((a, b) => parseInt(a) - parseInt(b))
      }
    }
    
    // Fallback al mapeo estático si no hay content_scope
    const fallbackMapping = getSectionMapping(sectionSlug)
    const finalMapping = contentScopeMapping || fallbackMapping
    
    // Configurar datos de la sección con mapeo real
    const config = {
      name: sectionData.name,
      description: sectionData.description,
      slug: sectionData.slug,
      section_number: sectionData.section_number,
      icon: sectionData.icon,
      collection: {
        name: sectionData.content_collections?.name || 'Procedimiento Administrativo',
        slug: sectionData.content_collections?.slug || 'procedimiento-administrativo'
      },
      // Añadir información del mapeo
      mapping: finalMapping,
      articles: finalMapping ? Object.values(finalMapping.laws).flatMap(law => law.articles) : [],
      hasMapping: hasContentScope || !!fallbackMapping,
      usingContentScope: hasContentScope
    }

    // Calcular estadísticas reales
    let questionsCount = 0
    
    if (hasContentScope && contentScopes) {
      try {
        // Usar content_scope ya cargado para encontrar preguntas de esta sección
        for (const scope of contentScopes) {
          // Para cada artículo específico en el scope
          for (const articleNumber of scope.article_numbers) {
            // Obtener el ID del artículo específico
            const { data: article } = await supabase
              .from('articles')
              .select('id')
              .eq('law_id', scope.law_id)
              .eq('article_number', articleNumber)
              .single()
            
            if (article) {
              // Contar preguntas vinculadas a este artículo específico
              const { count } = await supabase
                .from('questions')
                .select('id', { count: 'exact', head: true })
                .eq('primary_article_id', article.id)
                .eq('is_active', true)
              
              questionsCount += count || 0
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Error calculando preguntas de sección:', error.message)
      }
    } else if (finalMapping) {
      try {
        // Fallback: buscar por contenido temático usando mapeo estático
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .ilike('question_text', '%Ley 39/2015%')
          .eq('is_active', true)
        
        questionsCount = count || 0
      } catch (error) {
        console.log('⚠️ Error calculando preguntas de sección (fallback):', error.message)
      }
    }

    // Calcular estadísticas reales basadas en content_scope o fallback
    let articlesCount = 0
    let lawsCount = 0
    
    if (hasContentScope && contentScopeMapping) {
      // Calcular desde content_scope real
      lawsCount = Object.keys(contentScopeMapping.laws).length
      articlesCount = Object.values(contentScopeMapping.laws).reduce((total, law) => total + law.articles.length, 0)
    } else {
      // Usar estadísticas del mapeo estático como fallback
      const sectionStats = getSectionStats(sectionSlug)
      articlesCount = sectionStats.articlesCount
      lawsCount = sectionStats.lawsCount
    }

    const stats = {
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

// Cargar preguntas específicas de una sección
export async function loadProcedimientoSectionQuestions(sectionSlug, options = {}) {
  const supabase = getServerSupabaseClient()
  const mapping = getSectionMapping(sectionSlug)
  
  if (!mapping) {
    return { questions: [], error: 'Sección no encontrada en el mapeo' }
  }

  const { limit = 50, offset = 0, onlyOfficial = false } = options
  
  try {
    let query = supabase
      .from('questions')
      .select(`
        id, 
        question_text, 
        option_a, 
        option_b, 
        option_c, 
        option_d, 
        correct_option, 
        explanation,
        difficulty_level,
        is_official,
        created_at,
        articles!inner (
          id,
          article_number,
          laws!inner (
            short_name,
            name
          )
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filtrar por las leyes y artículos específicos de la sección
    const lawsInSection = Object.keys(mapping.laws)
    let filteredQuestions = []
    
    for (const lawShortName of lawsInSection) {
      const articleNumbers = mapping.laws[lawShortName].articles
      
      for (const articleNumber of articleNumbers) {
        const { data, error } = await query
          .eq('articles.laws.short_name', lawShortName)
          .eq('articles.article_number', articleNumber)

        if (error) {
          console.log(`⚠️ Error cargando preguntas ${lawShortName}:${articleNumber}:`, error.message)
          continue
        }

        if (data && data.length > 0) {
          filteredQuestions = filteredQuestions.concat(data)
        }
      }
    }

    // Filtrar solo oficiales si se solicita
    if (onlyOfficial) {
      filteredQuestions = filteredQuestions.filter(q => q.is_official)
    }

    // Limitar resultados finales
    filteredQuestions = filteredQuestions.slice(0, limit)

    return { 
      questions: filteredQuestions, 
      error: null,
      totalFound: filteredQuestions.length,
      mapping
    }

  } catch (error) {
    console.error('Error cargando preguntas de sección:', error)
    return { questions: [], error: error.message }
  }
}

// Función para obtener keywords de búsqueda específicos para cada sección
function getSectionKeywords(sectionSlug) {
  const keywords = {
    'conceptos-generales': [
      'Ley 39/2015',
      'principios de actuación',
      'procedimiento administrativo',
      'derechos de los ciudadanos',
      'capacidad de obrar'
    ],
    'el-procedimiento-administrativo': [
      'iniciación del procedimiento',
      'ordenación del procedimiento', 
      'instrucción del procedimiento',
      'finalización del procedimiento',
      'tramitación'
    ],
    'responsabilidad-patrimonial': [
      'responsabilidad patrimonial',
      'daños y perjuicios',
      'indemnización',
      'nexo causal',
      'Ley 40/2015'
    ],
    'terminos-plazos': [
      'cómputo de plazos',
      'términos',
      'plazo para resolver',
      'calendario administrativo',
      'días hábiles'
    ],
    'actos-administrativos': [
      'acto administrativo',
      'requisitos de los actos',
      'forma de los actos',
      'motivación',
      'contenido'
    ],
    'eficacia-validez-actos': [
      'eficacia de los actos',
      'suspensión',
      'ejecutividad',
      'validez',
      'revocación'
    ],
    'nulidad-anulabilidad': [
      'nulidad de pleno derecho',
      'anulabilidad',
      'nulos',
      'vicios',
      'invalidez'
    ],
    'revision-oficio': [
      'revisión de oficio',
      'revisión de disposiciones',
      'revisión de actos',
      'declaración de lesividad',
      'rectificación de errores'
    ],
    'recursos-administrativos': [
      'recurso de alzada',
      'recurso de reposición', 
      'recurso administrativo',
      'recurso extraordinario',
      'impugnación'
    ],
    'jurisdiccion-contencioso': [
      'jurisdicción contencioso',
      'contencioso-administrativa',
      'Ley 29/1998',
      'control jurisdiccional',
      'recurso contencioso'
    ]
  }
  
  return keywords[sectionSlug] || []
}

// Generar metadata dinámica para secciones
export function generateProcedimientoSectionMetadata(sectionConfig) {
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