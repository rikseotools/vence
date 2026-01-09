import { createClient } from '@supabase/supabase-js'

// 🔒 SEGURIDAD: Esta API es para debug de UI, NO devuelve correct_option
// La validación de respuestas se hace via /api/answer o /api/answer/psychometric

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
    // 🔒 SEGURIDAD: NO seleccionar correct_option
    const { data: lawQuestion, error: lawError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        explanation, primary_article_id, is_active, created_at,
        articles!primary_article_id(
          id, article_number, title,
          laws(id, short_name, official_name)
        )
      `)
      .eq('id', id)
      .single()

    if (lawQuestion && !lawError) {
      // 🔒 SEGURIDAD: NO incluir correct_option ni correct_answer
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
        // 🔒 correct_option y correct_answer eliminados - validar via API
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
    // 🔒 SEGURIDAD: NO seleccionar correct_option
    const { data: question, error } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, option_a, option_b, option_c, option_d,
        content_data, explanation, is_active, created_at,
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

    // 🔒 SEGURIDAD: NO incluir correct_option ni correct_answer
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
      // 🔒 correct_option y correct_answer eliminados - validar via API
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