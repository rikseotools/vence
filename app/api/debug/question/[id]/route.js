import { createClient } from '@supabase/supabase-js'

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params
    const { id } = resolvedParams

    if (!id) {
      return Response.json({ error: 'Question ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Primero intentar buscar en la tabla questions (preguntas de leyes)
    const { data: lawQuestion, error: lawError } = await supabase
      .from('questions')
      .select(`
        *,
        articles!primary_article_id(
          id, article_number, title,
          laws(id, short_name, official_name)
        )
      `)
      .eq('id', id)
      .single()

    if (lawQuestion && !lawError) {
      // Determinar la respuesta correcta
      const correctLetter = lawQuestion.correct_option?.toUpperCase() || 'A'
      const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter)

      // Formatear respuesta para pregunta de ley
      const formattedQuestion = {
        id: lawQuestion.id,
        question_text: lawQuestion.question_text,
        question_subtype: 'text_question',
        options: {
          A: lawQuestion.option_a,
          B: lawQuestion.option_b,
          C: lawQuestion.option_c,
          D: lawQuestion.option_d
        },
        correct_option: correctIndex >= 0 ? correctIndex : 0,
        correct_answer: correctLetter,
        content_data: null,
        explanation: lawQuestion.explanation,
        category_id: lawQuestion.articles?.laws?.id || null,
        category: {
          key: lawQuestion.articles?.laws?.short_name || 'ley',
          name: lawQuestion.articles?.laws?.official_name || 'Ley'
        },
        section: {
          key: `articulo-${lawQuestion.articles?.article_number || '?'}`,
          name: `Artículo ${lawQuestion.articles?.article_number || '?'} - ${lawQuestion.articles?.title || ''}`
        },
        primary_article_id: lawQuestion.primary_article_id,
        is_active: lawQuestion.is_active,
        created_at: lawQuestion.created_at,
        question_type: 'law'
      }

      return Response.json({
        success: true,
        question: formattedQuestion
      })
    }

    // Si no está en questions, buscar en psychometric_questions
    const { data: question, error } = await supabase
      .from('psychometric_questions')
      .select(`
        *,
        psychometric_sections!inner(
          section_key, display_name,
          psychometric_categories!inner(category_key, display_name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching question:', error)
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Formatear respuesta con datos reales (pregunta psicotécnica)
    const formattedQuestion = {
      id: question.id,
      question_text: question.question_text,
      question_subtype: question.question_subtype,
      options: {
        A: question.option_a,
        B: question.option_b,
        C: question.option_c,
        D: question.option_d
      },
      correct_option: question.correct_option,
      correct_answer: ['A', 'B', 'C', 'D'][question.correct_option],
      content_data: question.content_data,
      explanation: question.explanation,
      category: {
        key: question.psychometric_sections.psychometric_categories.category_key,
        name: question.psychometric_sections.psychometric_categories.display_name
      },
      section: {
        key: question.psychometric_sections.section_key,
        name: question.psychometric_sections.display_name
      },
      is_active: question.is_active,
      created_at: question.created_at,
      question_type: 'psychometric'
    }

    return Response.json({
      success: true,
      question: formattedQuestion
    })

  } catch (error) {
    console.error('API Error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}