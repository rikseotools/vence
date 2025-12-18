import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verify-articles/questions
 * Obtiene las preguntas vinculadas a un artículo específico de una ley
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const articleNumber = searchParams.get('articleNumber')

  if (!lawId || !articleNumber) {
    return Response.json({
      success: false,
      error: 'Se requiere lawId y articleNumber'
    }, { status: 400 })
  }

  try {
    // Primero obtenemos el artículo
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', lawId)
      .eq('article_number', articleNumber)
      .single()

    if (articleError && articleError.code !== 'PGRST116') {
      console.error('Error buscando artículo:', articleError)
    }

    // Buscar preguntas que referencien este artículo
    // Las preguntas pueden estar vinculadas por:
    // 1. primary_article_id (FK directa)
    // 2. Referencia en el texto de la pregunta (ej: "Según el artículo 15...")

    let questions = []

    // Método 1: Por FK directa si el artículo existe en BD
    if (article?.id) {
      const { data: directQuestions, error: directError } = await supabase
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
          is_official_exam,
          difficulty
        `)
        .eq('primary_article_id', article.id)
        .eq('is_active', true)
        .limit(50)

      console.log(`📋 Artículo ${articleNumber} (id: ${article.id}): ${directQuestions?.length || 0} preguntas encontradas`)

      if (!directError && directQuestions) {
        questions = directQuestions
      }
    }

    // Método 2: Buscar en el texto de la pregunta referencias al artículo
    // Solo si no encontramos por FK directa
    if (questions.length === 0) {
      // Buscar preguntas que mencionen este artículo en su texto
      // Primero necesitamos saber qué ley es para filtrar
      const { data: law } = await supabase
        .from('laws')
        .select('short_name')
        .eq('id', lawId)
        .single()

      if (law) {
        // Buscar preguntas que mencionen "artículo X" y estén relacionadas con esta ley
        const searchPatterns = [
          `artículo ${articleNumber}`,
          `art. ${articleNumber}`,
          `Art. ${articleNumber}`,
          `articulo ${articleNumber}`
        ]

        const { data: textQuestions, error: textError } = await supabase
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
            is_official_exam,
            difficulty,
            primary_article_id,
            articles!inner (
              law_id
            )
          `)
          .eq('articles.law_id', lawId)
          .eq('is_active', true)
          .or(searchPatterns.map(p => `question_text.ilike.%${p}%`).join(','))
          .limit(50)

        if (!textError && textQuestions) {
          // Filtrar para asegurar que realmente mencionan el artículo correcto
          questions = textQuestions.filter(q => {
            const text = q.question_text.toLowerCase()
            return searchPatterns.some(p => text.includes(p.toLowerCase()))
          })
        }
      }
    }

    return Response.json({
      success: true,
      articleNumber,
      article: article ? {
        id: article.id,
        title: article.title,
        content: article.content?.substring(0, 500) + (article.content?.length > 500 ? '...' : '')
      } : null,
      questions,
      count: questions.length
    })

  } catch (error) {
    console.error('Error obteniendo preguntas:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
