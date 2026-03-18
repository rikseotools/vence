// app/api/teoria/[law]/[articleNumber]/route.ts
import { NextRequest } from 'next/server'
import { fetchArticleContent, fetchArticleOfficialExamData } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest, { params }: { params: Promise<{ law: string; articleNumber: string }> }) {
  try {
    const resolvedParams = await params
    const lawSlug = resolvedParams.law
    const articleParam = resolvedParams.articleNumber

    // Extraer identificador de artículo (puede ser numérico o texto: "14", "General", "DA2", etc.)
    let articleId: string | null = null
    if (articleParam) {
      if (articleParam.startsWith('articulo-')) {
        articleId = articleParam.replace('articulo-', '')
      } else {
        articleId = articleParam
      }
    }

    if (!articleId) {
      return Response.json(
        { error: 'Identificador de artículo no válido' },
        { status: 400 }
      )
    }

    // Pasar como string — article_number es text en BD, soporta "14", "General", "DA2", etc.
    const article = await fetchArticleContent(lawSlug, articleId)

    // Si es ley virtual y contenido vacío, devolver 200 con flag isVirtual
    if ((article as any).isVirtual && (!article.content || article.content.trim().length === 0)) {
      return Response.json({
        isVirtual: true,
        law: article.law,
        article_number: article.article_number,
        title: article.title,
      })
    }

    // Obtener información del usuario para filtrar exámenes oficiales por oposición
    const { searchParams } = new URL(request.url)
    const includeOfficialExams = searchParams.get('includeOfficialExams') === 'true'
    const userOposicion = searchParams.get('userOposicion')

    // Si se solicita información de exámenes oficiales, incluirla
    if (includeOfficialExams && article.id) {
      const officialExamData = await fetchArticleOfficialExamData(article.id, userOposicion)
      ;(article as any).officialExamData = officialExamData
    }

    return Response.json(article)

  } catch (error) {
    console.error('Error en API de artículo:', error)

    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    const isNotFound = message.includes('ARTICULO_NO_ENCONTRADO') || message.includes('LEY_NO_RECONOCIDA')

    return Response.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    )
  }
}

export const GET = withErrorLogging('/api/teoria/[law]/[articleNumber]', _GET)
