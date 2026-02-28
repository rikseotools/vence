import { NextRequest, NextResponse } from 'next/server'
import { aiVerifySingleParamsSchema } from '@/lib/api/verify-articles/schemas'
import { getLawById, getQuestionById } from '@/lib/api/verify-articles/queries'
import {
  fetchArticleFromBOE,
  buildSingleVerificationPrompt,
} from '@/lib/api/verify-articles/ai-helpers'

async function verifyWithOpenAI(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'OpenAI API key no configurada. Añade OPENAI_API_KEY en .env.local' }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })
    const data = await response.json()
    if (data.error) return { error: data.error.message }
    const content = data.choices?.[0]?.message?.content
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
    } catch {
      return { isCorrect: null, explanation: content, error: 'No se pudo parsear la respuesta como JSON' }
    }
    return { explanation: content }
  } catch (error) { return { error: (error as Error).message } }
}

async function verifyWithClaude(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'Anthropic API key no configurada. Añade ANTHROPIC_API_KEY en .env.local' }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (data.error) return { error: data.error.message }
    const content = data.content?.[0]?.text
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
    } catch {
      return { isCorrect: null, explanation: content, error: 'No se pudo parsear la respuesta como JSON' }
    }
    return { explanation: content }
  } catch (error) { return { error: (error as Error).message } }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = aiVerifySingleParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { lawId, articleNumber, questionId, provider } = validation.data

    const law = await getLawById(lawId)
    if (!law) return NextResponse.json({ success: false, error: 'Ley no encontrada' }, { status: 404 })

    const question = await getQuestionById(questionId)
    if (!question) return NextResponse.json({ success: false, error: 'Pregunta no encontrada' }, { status: 404 })

    const boeContent = await fetchArticleFromBOE(law.boeUrl!, articleNumber)
    if (!boeContent) {
      return NextResponse.json(
        { success: false, error: `No se pudo obtener el contenido del artículo ${articleNumber} del BOE` },
        { status: 500 }
      )
    }

    const correctOptionLetter = ['A', 'B', 'C', 'D'][question.correctOption]
    const optionKey = `option${correctOptionLetter}` as 'optionA' | 'optionB' | 'optionC' | 'optionD'
    const correctAnswer = question[optionKey]

    const prompt = buildSingleVerificationPrompt({
      lawName: `${law.shortName} - ${law.name}`,
      articleNumber,
      articleContent: boeContent,
      questionText: question.questionText,
      options: { a: question.optionA, b: question.optionB, c: question.optionC, d: question.optionD },
      correctOption: correctOptionLetter,
      correctAnswer,
      explanation: question.explanation,
    })

    const aiResponse = provider === 'claude'
      ? await verifyWithClaude(prompt)
      : await verifyWithOpenAI(prompt)

    return NextResponse.json({
      success: true,
      result: aiResponse,
      metadata: { provider, lawId, articleNumber, questionId, timestamp: new Date().toISOString() },
    })
  } catch (error) {
    console.error('Error en verificación IA:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}
