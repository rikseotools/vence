// app/api/generate-explanation/route.ts
// Genera explicación con IA para preguntas sin explicación y la guarda en BD
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { questionId, questionText, options, correctAnswer, articleNumber, lawName } = await request.json()

    if (!questionId || !questionText || !options || correctAnswer === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // Verificar que la pregunta existe y no tiene explicación
    const { data: question, error: fetchError } = await getSupabase()
      .from('questions')
      .select('id, explanation')
      .eq('id', questionId)
      .single()

    if (fetchError) {
      console.error('Error fetching question:', fetchError)
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })
    }

    // Si ya tiene explicación, devolverla
    if (question.explanation && question.explanation.trim().length > 0) {
      return NextResponse.json({
        explanation: question.explanation,
        source: 'existing'
      })
    }

    // Obtener API key de OpenAI
    const { data: apiConfig } = await getSupabase()
      .from('ai_api_config')
      .select('api_key_encrypted')
      .eq('provider', 'openai')
      .eq('is_active', true)
      .single()

    if (!apiConfig?.api_key_encrypted) {
      return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
    }

    const apiKey = Buffer.from(apiConfig.api_key_encrypted, 'base64').toString('utf-8')
    const openai = new OpenAI({ apiKey })

    // Construir el prompt
    const correctLetter = String.fromCharCode(65 + correctAnswer)
    const optionsText = options.map((opt: string, i: number) =>
      `${String.fromCharCode(65 + i)}) ${opt}`
    ).join('\n')

    const contextInfo = articleNumber && lawName
      ? `\n\nContexto legal: Artículo ${articleNumber} de ${lawName}`
      : ''

    const prompt = `Genera una explicación clara y educativa para esta pregunta de oposiciones.

PREGUNTA: ${questionText}

OPCIONES:
${optionsText}

RESPUESTA CORRECTA: ${correctLetter}${contextInfo}

INSTRUCCIONES:
- Explica POR QUÉ la opción ${correctLetter} es correcta
- Si hay contexto legal, menciona el artículo relevante
- Usa un tono educativo y claro
- Máximo 3-4 párrafos cortos
- Usa formato con saltos de línea para mejor legibilidad
- NO uses markdown, solo texto plano con saltos de línea`

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en oposiciones españolas. Generas explicaciones claras y concisas para preguntas de examen.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    })

    const explanation = completion.choices[0]?.message?.content?.trim()

    if (!explanation) {
      return NextResponse.json({ error: 'No se pudo generar la explicación' }, { status: 500 })
    }

    // Guardar la explicación en la base de datos
    const { error: updateError } = await getSupabase()
      .from('questions')
      .update({
        explanation,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)

    if (updateError) {
      console.error('Error saving explanation:', updateError)
      // Aún así devolvemos la explicación aunque no se haya guardado
      return NextResponse.json({
        explanation,
        source: 'generated',
        saved: false
      })
    }

    console.log(`✅ Explicación generada y guardada para pregunta ${questionId}`)

    return NextResponse.json({
      explanation,
      source: 'generated',
      saved: true
    })

  } catch (error) {
    console.error('Error generating explanation:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}
