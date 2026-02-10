// app/api/ai/verify-answer/route.ts
// API para verificar respuestas de forma independiente (sin conocer la respuesta de antemano)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Buscar artículos relevantes por embedding
async function searchRelevantArticles(openai: OpenAI, searchText: string, lawName?: string | null) {
  try {
    // Generar embedding para búsqueda
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchText
    })
    const embedding = embeddingResponse.data[0].embedding

    // Buscar artículos similares
    const { data: articles, error } = await getSupabase().rpc('match_articles_by_embedding', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 10
    })

    if (error) {
      console.error('Error buscando artículos:', error)
      // Fallback: búsqueda por keywords
      return await searchArticlesByKeywords(searchText, lawName)
    }

    // Si hay ley específica, priorizar artículos de esa ley
    if (lawName && articles) {
      const lawArticles = articles.filter((a: any) =>
        a.law_name?.toLowerCase().includes(lawName.toLowerCase()) ||
        a.law_short_name?.toLowerCase().includes(lawName.toLowerCase())
      )
      if (lawArticles.length > 0) {
        return lawArticles.slice(0, 5)
      }
    }

    return articles?.slice(0, 5) || []
  } catch (error) {
    console.error('Error en búsqueda semántica:', error)
    return await searchArticlesByKeywords(searchText, lawName)
  }
}

// Fallback: búsqueda por keywords
async function searchArticlesByKeywords(searchText: string, lawName?: string | null) {
  const keywords = searchText.split(/\s+/).filter(w => w.length > 3).slice(0, 5)

  let query = getSupabase()
    .from('articles')
    .select('id, article_number, content, law_name, law_short_name')
    .limit(10)

  if (lawName) {
    query = query.or(`law_name.ilike.%${lawName}%,law_short_name.ilike.%${lawName}%`)
  }

  // Buscar por contenido
  for (const keyword of keywords) {
    query = query.ilike('content', `%${keyword}%`)
  }

  const { data } = await query
  return data || []
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const {
      questionId,
      questionText,
      options, // { a, b, c, d }
      lawName,
      articleNumber,
      dbCorrectAnswer // Lo que dice la BD (para comparar al final)
    } = body

    if (!questionText || !options) {
      return NextResponse.json({ error: 'Faltan datos de la pregunta' }, { status: 400 })
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

    // 1. Buscar artículos relevantes
    const searchQuery = lawName
      ? `${questionText} ${lawName} ${articleNumber || ''}`
      : questionText

    const articles = await searchRelevantArticles(openai, searchQuery, lawName)

    // Formatear contexto de artículos
    const articlesContext = articles.length > 0
      ? articles.map((a: any) =>
          `--- ${a.law_short_name || a.law_name} - Artículo ${a.article_number} ---\n${a.content}`
        ).join('\n\n')
      : 'No se encontraron artículos específicos en la base de datos.'

    // 2. Prompt para que el AI determine la respuesta SIN conocerla de antemano
    const verificationPrompt = `Eres un experto legal en legislación española. Tu tarea es VERIFICAR cuál es la respuesta correcta a esta pregunta de oposiciones, basándote ÚNICAMENTE en la legislación.

PREGUNTA:
${questionText}

OPCIONES:
A) ${options.a}
B) ${options.b}
C) ${options.c}
D) ${options.d}

${lawName ? `LEY RELACIONADA: ${lawName}${articleNumber ? ` - Artículo ${articleNumber}` : ''}` : ''}

ARTÍCULOS DE LEGISLACIÓN ENCONTRADOS:
${articlesContext}

INSTRUCCIONES CRÍTICAS:
1. Analiza la pregunta y las opciones cuidadosamente
2. Busca en los artículos proporcionados la información relevante
3. Determina cuál es la respuesta CORRECTA según la ley
4. Si la pregunta dice "NO puede" o "está prohibido", identifica qué opciones están prohibidas
5. Si la pregunta dice "SÍ puede" o "puede ejercer", identifica qué opciones están permitidas

RESPONDE CON ESTE FORMATO EXACTO:
RESPUESTA_VERIFICADA: [A/B/C/D]
CONFIANZA: [ALTA/MEDIA/BAJA]
FUNDAMENTO_LEGAL: [Cita el artículo específico que sustenta tu respuesta]
RAZONAMIENTO: [Explica brevemente por qué esa es la respuesta correcta]`

    // 3. Llamar a OpenAI para verificación independiente
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un verificador legal imparcial. Tu única tarea es determinar la respuesta correcta basándote en la legislación, sin ningún sesgo. Si no estás seguro, indica confianza BAJA.'
        },
        {
          role: 'user',
          content: verificationPrompt
        }
      ],
      max_tokens: 800,
      temperature: 0.1 // Baja temperatura para respuestas más deterministas
    })

    const aiResponse = completion.choices[0]?.message?.content || ''

    // 4. Parsear la respuesta del AI
    const respuestaMatch = aiResponse.match(/RESPUESTA_VERIFICADA:\s*([A-D])/i)
    const confianzaMatch = aiResponse.match(/CONFIANZA:\s*(ALTA|MEDIA|BAJA)/i)
    const fundamentoMatch = aiResponse.match(/FUNDAMENTO_LEGAL:\s*([\s\S]+?)(?=RAZONAMIENTO:|$)/i)
    const razonamientoMatch = aiResponse.match(/RAZONAMIENTO:\s*([\s\S]+)/i)

    const aiAnswer = respuestaMatch ? respuestaMatch[1].toUpperCase() : null
    const confidence = confianzaMatch ? confianzaMatch[1].toUpperCase() : 'BAJA'
    const legalBasis = fundamentoMatch ? fundamentoMatch[1].trim() : ''
    const reasoning = razonamientoMatch ? razonamientoMatch[1].trim() : ''

    // 5. Comparar con la respuesta de la BD
    const dbAnswerLetter = dbCorrectAnswer
      ? (typeof dbCorrectAnswer === 'number'
          ? ['A', 'B', 'C', 'D'][dbCorrectAnswer]
          : dbCorrectAnswer.toUpperCase())
      : null

    const matches = aiAnswer === dbAnswerLetter
    const verificationResult = {
      verified: matches,
      aiAnswer,
      dbAnswer: dbAnswerLetter,
      confidence,
      legalBasis,
      reasoning,
      articlesFound: articles.length,
      discrepancy: !matches && aiAnswer && dbAnswerLetter,
      responseTimeMs: Date.now() - startTime
    }

    // 6. Si hay discrepancia, loguear para revisión
    if (verificationResult.discrepancy) {
      console.log(`⚠️ DISCREPANCIA DETECTADA en pregunta ${questionId}:`)
      console.log(`   BD dice: ${dbAnswerLetter}`)
      console.log(`   AI dice: ${aiAnswer} (confianza: ${confidence})`)

      // Opcional: guardar en tabla de revisión
      try {
        await getSupabase().from('question_verifications').insert({
          question_id: questionId,
          db_answer: dbAnswerLetter,
          ai_answer: aiAnswer,
          ai_confidence: confidence,
          ai_reasoning: reasoning,
          legal_basis: legalBasis,
          status: 'pending_review'
        })
      } catch (e) {
        // Tabla puede no existir, ignorar
      }
    }

    return NextResponse.json(verificationResult)

  } catch (error) {
    console.error('Error en verificación:', error)
    return NextResponse.json({
      error: 'Error al verificar la respuesta',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
