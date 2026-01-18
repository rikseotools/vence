import { getDb } from '@/db/client'
import { laws, articles, topicScope } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

// Configuracion oficial de leyes segun BOE
const LEYES_OFICIALES: Record<string, {
  nombre: string
  articuloMax: number
  articulosEspeciales: string[]
  articulosProhibidos: string[]
}> = {
  'RDL 5/2015': {
    nombre: 'Estatuto Basico del Empleado Publico (EBEP)',
    articuloMax: 100,
    articulosEspeciales: ['47bis'],
    articulosProhibidos: ['101', '149'],
  },
  'CE': {
    nombre: 'Constitucion Espanola',
    articuloMax: 169,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 39/2015': {
    nombre: 'Ley del Procedimiento Administrativo Comun',
    articuloMax: 133,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 40/2015': {
    nombre: 'Ley de Regimen Juridico del Sector Publico',
    articuloMax: 158,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
}

interface LawRecord {
  id: string
  shortName: string
  name: string
}

interface ArticleRecord {
  id: string
  articleNumber: string
  title: string | null
  isActive: boolean | null
}

interface TopicScopeRecord {
  id: string
  lawId: string | null
  articleNumbers: string[] | null
}

interface ValidationResult {
  errors: string[]
  warnings: string[]
  stats: {
    totalArticles: number
    activeArticles: number
    topicScopeCount: number
  }
}

async function validateLaw(
  db: ReturnType<typeof getDb>,
  law: LawRecord,
  config: typeof LEYES_OFICIALES[string]
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const stats = {
    totalArticles: 0,
    activeArticles: 0,
    topicScopeCount: 0
  }

  // 1. Obtener articulos de la ley
  const lawArticles = await db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      title: articles.title,
      isActive: articles.isActive
    })
    .from(articles)
    .where(eq(articles.lawId, law.id))

  stats.totalArticles = lawArticles.length
  const activeArticles = lawArticles.filter(a => a.isActive)
  stats.activeArticles = activeArticles.length

  // 2. Validar articulos fuera de rango
  const numericArticles = activeArticles.filter(a => /^\d+$/.test(a.articleNumber))
  for (const article of numericArticles) {
    const num = parseInt(article.articleNumber)
    if (num > config.articuloMax) {
      errors.push(`Articulo ${num} fuera de rango (max: ${config.articuloMax}) - "${article.title?.substring(0, 50)}..."`)
    }
  }

  // 3. Validar articulos prohibidos
  for (const prohibido of config.articulosProhibidos) {
    const found = activeArticles.find(a => a.articleNumber === prohibido)
    if (found) {
      errors.push(`Articulo ${prohibido} NO debe existir (esta activo) - "${found.title?.substring(0, 50)}..."`)
    }
  }

  // 4. Validar duplicados
  const normalizedNumbers = activeArticles.map(a =>
    a.articleNumber.toLowerCase().replace(/\s+/g, '')
  )

  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const num of normalizedNumbers) {
    if (seen.has(num)) {
      duplicates.add(num)
    }
    seen.add(num)
  }

  if (duplicates.size > 0) {
    errors.push(`Articulos duplicados: ${Array.from(duplicates).join(', ')}`)
  }

  // 5. Validar articulos especiales existen una sola vez
  for (const especial of config.articulosEspeciales) {
    const matches = activeArticles.filter(a =>
      a.articleNumber.toLowerCase().replace(/\s+/g, '') === especial.toLowerCase()
    )

    if (matches.length === 0) {
      warnings.push(`Articulo especial ${especial} no encontrado`)
    } else if (matches.length > 1) {
      errors.push(`Articulo especial ${especial} duplicado (${matches.length} veces)`)
    }
  }

  // 6. Obtener topic_scope para esta ley
  const scopes = await db
    .select({
      id: topicScope.id,
      articleNumbers: topicScope.articleNumbers,
      topicId: topicScope.topicId
    })
    .from(topicScope)
    .where(eq(topicScope.lawId, law.id))

  stats.topicScopeCount = scopes.length

  // 7. Validar topic_scope no referencia articulos prohibidos
  for (const scope of scopes) {
    for (const prohibido of config.articulosProhibidos) {
      if (scope.articleNumbers?.includes(prohibido)) {
        errors.push(`topic_scope ${scope.id.substring(0, 8)} referencia articulo prohibido ${prohibido}`)
      }
    }
  }

  return { errors, warnings, stats }
}

// Leyes virtuales (informatica) que no tienen articulos reales en BOE
// Se excluyen de la validacion de topic_scope
const LEYES_VIRTUALES = [
  'Base de datos: Access',
  'Hojas de cálculo. Excel',
  'Procesadores de texto',
]

async function validateTopicScopeReferences(db: ReturnType<typeof getDb>): Promise<string[]> {
  const topicScopeErrors: string[] = []

  // Obtener todos los topic_scope con info de ley
  const allScopes = await db
    .select({
      id: topicScope.id,
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers
    })
    .from(topicScope)

  // Agrupar por ley para optimizar queries
  const scopesByLaw = new Map<string, typeof allScopes>()
  for (const scope of allScopes) {
    if (!scope.lawId || !scope.articleNumbers?.length) continue
    const existing = scopesByLaw.get(scope.lawId) || []
    existing.push(scope)
    scopesByLaw.set(scope.lawId, existing)
  }

  // Validar cada ley
  for (const [lawId, scopesForLaw] of Array.from(scopesByLaw.entries())) {
    // Obtener articulos activos de esta ley
    const lawArticles = await db
      .select({
        articleNumber: articles.articleNumber
      })
      .from(articles)
      .where(and(
        eq(articles.lawId, lawId),
        eq(articles.isActive, true)
      ))

    // Obtener nombre de la ley
    const lawRecord = await db
      .select({ shortName: laws.shortName })
      .from(laws)
      .where(eq(laws.id, lawId))
      .limit(1)

    const lawName = lawRecord[0]?.shortName || 'ley desconocida'

    // Saltar leyes virtuales (informatica)
    if (LEYES_VIRTUALES.includes(lawName)) {
      continue
    }

    const validNumbers = new Set(lawArticles.map(a => a.articleNumber))

    for (const scope of scopesForLaw) {
      for (const artNum of scope.articleNumbers || []) {
        if (!validNumbers.has(artNum)) {
          topicScopeErrors.push(
            `topic_scope ${scope.id.substring(0, 8)} (${lawName}): referencia articulo inexistente "${artNum}"`
          )
        }
      }
    }
  }

  return topicScopeErrors
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cached = searchParams.get('cached')

  // Si pide cached, devolver resultado vacio (no hay cache implementado aun)
  if (cached === 'true') {
    return Response.json({
      success: true,
      results: null,
      lastCheck: null
    })
  }

  try {
    const db = getDb()
    const lawResults: Array<{
      shortName: string
      nombre: string
      lawId?: string
      errors: string[]
      warnings: string[]
      stats: ValidationResult['stats'] | null
    }> = []
    let totalErrors = 0
    let totalWarnings = 0

    // Obtener todas las leyes
    const allLaws = await db
      .select({
        id: laws.id,
        shortName: laws.shortName,
        name: laws.name
      })
      .from(laws)

    // Validar cada ley configurada
    for (const [shortName, config] of Object.entries(LEYES_OFICIALES)) {
      const law = allLaws.find(l => l.shortName === shortName)

      if (!law) {
        lawResults.push({
          shortName,
          nombre: config.nombre,
          errors: [],
          warnings: [`Ley ${shortName} no encontrada en la BD`],
          stats: null
        })
        totalWarnings++
        continue
      }

      const result = await validateLaw(db, law, config)
      totalErrors += result.errors.length
      totalWarnings += result.warnings.length

      lawResults.push({
        shortName,
        nombre: config.nombre,
        lawId: law.id,
        errors: result.errors,
        warnings: result.warnings,
        stats: result.stats
      })
    }

    // Validar referencias de topic_scope
    const topicScopeErrors = await validateTopicScopeReferences(db)
    totalErrors += topicScopeErrors.length

    return Response.json({
      success: true,
      summary: {
        totalErrors,
        totalWarnings,
        lawsChecked: lawResults.length
      },
      lawResults,
      topicScopeErrors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en validacion de integridad:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
