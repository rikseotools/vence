// app/api/teoria/[law]/[articleNumber]/route.js
import { fetchArticleContent, fetchArticleOfficialExamData } from '../../../../lib/teoriaFetchers'
import { mapLawSlugToShortName } from '../../../../lib/lawMappingUtils'
import { createClient } from '@supabase/supabase-js'

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params
    const lawSlug = resolvedParams.law
    const articleParam = resolvedParams.articleNumber
    
    // Extraer número de artículo
    let articleNumber = null
    if (articleParam) {
      if (articleParam.startsWith('articulo-')) {
        articleNumber = articleParam.replace('articulo-', '')
      } else {
        articleNumber = articleParam
      }
    }

    if (!articleNumber) {
      return Response.json(
        { error: 'Número de artículo no válido' },
        { status: 400 }
      )
    }

    const article = await fetchArticleContent(lawSlug, parseInt(articleNumber))
    
    // Obtener información del usuario para filtrar exámenes oficiales por oposición
    const { searchParams } = new URL(request.url)
    const includeOfficialExams = searchParams.get('includeOfficialExams') === 'true'
    const userOposicion = searchParams.get('userOposicion')
    
    // Si se solicita información de exámenes oficiales, incluirla
    if (includeOfficialExams && article.id) {
      const officialExamData = await fetchArticleOfficialExamData(article.id, userOposicion)
      article.officialExamData = officialExamData
    }
    
    return Response.json(article)
    
  } catch (error) {
    console.error('Error en API de artículo:', error)
    
    return Response.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}