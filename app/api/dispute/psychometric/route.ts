// app/api/dispute/psychometric/route.ts
// API para crear impugnaciones de preguntas psicotécnicas
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, userId, disputeType, description } = body

    // Validaciones
    if (!questionId || !userId || !disputeType || !description) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Validar tipo de disputa
    const validTypes = ['ai_detected_error', 'respuesta_incorrecta', 'otro']
    if (!validTypes.includes(disputeType)) {
      return NextResponse.json(
        { error: 'Tipo de impugnación no válido' },
        { status: 400 }
      )
    }

    // Verificar que la pregunta existe
    const { data: question, error: questionError } = await getSupabaseAdmin()
      .from('psychometric_questions')
      .select('id')
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Pregunta no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que el usuario no haya impugnado ya esta pregunta
    const { data: existing } = await getSupabaseAdmin()
      .from('psychometric_question_disputes')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya has impugnado esta pregunta anteriormente' },
        { status: 409 }
      )
    }

    // Insertar la impugnación
    const { data, error } = await getSupabaseAdmin()
      .from('psychometric_question_disputes')
      .insert({
        question_id: questionId,
        user_id: userId,
        dispute_type: disputeType,
        description: description,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando impugnación psicotécnica:', error)
      return NextResponse.json(
        { error: 'Error al crear la impugnación' },
        { status: 500 }
      )
    }

    console.log('✅ Impugnación psicotécnica creada:', data.id)

    return NextResponse.json({
      success: true,
      disputeId: data.id
    })

  } catch (error) {
    console.error('Error en API dispute/psychometric:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
