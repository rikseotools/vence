// app/api/generate-explanation/route.ts
// Genera explicación con IA para preguntas sin explicación y la guarda en BD
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

import { getAdminDb } from '@/db/client'
import { questions, aiApiConfig } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateQuestionsCache } from '@/lib/cache/questions'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

async function _POST(request: NextRequest) {
  try {
    const { questionId, questionText, options, correctAnswer, articleNumber, lawName } = await request.json()

    if (!questionId || !questionText || !options || correctAnswer === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // Verificar que la pregunta existe y no tiene explicación
    let question = null
    let fetchError = null
    try {
      const [row] = await db()
        .select({ id: questions.id, explanation: questions.explanation })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1)
      question = row ?? null
    } catch (e) {
      fetchError = e
    }

    if (fetchError || !question) {
      if (fetchError) console.error('Error fetching question:', fetchError)
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
    const [apiConfig] = await db()
      .select({ api_key_encrypted: aiApiConfig.apiKeyEncrypted })
      .from(aiApiConfig)
      .where(and(eq(aiApiConfig.provider, 'openai'), eq(aiApiConfig.isActive, true)))
      .limit(1)

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
    let updateError = null
    try {
      await db()
        .update(questions)
        .set({
          explanation,
          updatedAt: new Date().toISOString()
        })
        .where(eq(questions.id, questionId))
    } catch (e) {
      updateError = e
    }

    if (updateError) {
      console.error('Error saving explanation:', updateError)
      // Aún así devolvemos la explicación aunque no se haya guardado
      return NextResponse.json({
        explanation,
        source: 'generated',
        saved: false
      })
    }

    // El UPDATE llegó: invalidar cache (tag 'questions') para que
    // answer-and-save sirva la explicación nueva sin esperar TTL.
    invalidateQuestionsCache()

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

export const POST = withErrorLogging('/api/generate-explanation', _POST)
