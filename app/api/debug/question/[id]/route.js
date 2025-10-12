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

    // Obtener pregunta básica primero
    const { data: question, error } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching question:', error)
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Formatear respuesta (simplificado sin joins)
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
        key: 'capacidad-administrativa',
        name: 'Capacidad Administrativa'
      },
      section: {
        key: 'graficos',
        name: 'Gráficos'
      },
      is_active: question.is_active,
      created_at: question.created_at
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