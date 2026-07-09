// app/api/ai/verify-answer/route.ts
// API para verificar respuestas de forma independiente (sin conocer la respuesta de antemano)

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { and, or, eq, ilike } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAiApiKey } from '@/lib/api/admin-ai-config/getAiApiKey'
import { searchArticlesBySimilarity } from '@/lib/chat/domains/search/queries'
import { getDb } from '@/db/client'
import { articles as articlesTable, laws as lawsTable } from '@/db/schema'

// Forma unificada de artículo para el contexto del prompt (agnóstica de proveedor).
type CtxArticle = { lawShortName: string; lawName: string; articleNumber: string | null; content: string | null }

// Buscar artículos relevantes por embedding — RDS (pgvector `match_articles`, vía
// el mismo camino que el chat). AGNÓSTICO: sin Supabase (migrado 09/07/2026).
async function searchRelevantArticles(openai: OpenAI, searchText: string, lawName?: string | null): Promise<CtxArticle[]> {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchText,
    })
    const embedding = embeddingResponse.data[0].embedding

    const matches = await searchArticlesBySimilarity(embedding, {
      limit: 5,
      minSimilarity: 0.5,
      mentionedLawNames: lawName ? [lawName] : [],
    })
    if (matches.length > 0) {
      return matches.map(a => ({
        lawShortName: a.lawShortName,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        content: a.content,
      }))
    }
    // Sin resultados semánticos → fallback por keywords.
    return await searchArticlesByKeywords(searchText, lawName)
  } catch (error) {
    console.error('Error en búsqueda semántica:', error)
    return await searchArticlesByKeywords(searchText, lawName)
  }
}

// Fallback por keywords — RDS/Drizzle (articles + laws), sin Supabase.
async function searchArticlesByKeywords(searchText: string, lawName?: string | null): Promise<CtxArticle[]> {
  const keyword = searchText.split(/\s+/).filter(w => w.length > 3)[0]
  if (!keyword) return []
  try {
    const rows = await getDb()
      .select({
        articleNumber: articlesTable.articleNumber,
        content: articlesTable.content,
        lawShortName: lawsTable.shortName,
        lawName: lawsTable.name,
      })
      .from(articlesTable)
      .leftJoin(lawsTable, eq(lawsTable.id, articlesTable.lawId))
      .where(
        and(
          eq(articlesTable.isActive, true),
          ilike(articlesTable.content, `%${keyword}%`),
          lawName
            ? or(ilike(lawsTable.name, `%${lawName}%`), ilike(lawsTable.shortName, `%${lawName}%`))
            : undefined,
        ),
      )
      .limit(5)
    return rows.map(r => ({
      lawShortName: r.lawShortName ?? '',
      lawName: r.lawName ?? '',
      articleNumber: r.articleNumber,
      content: r.content,
    }))
  } catch (error) {
    console.error('Error en fallback por keywords:', error)
    return []
  }
}

async function _POST(request: NextRequest) {
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

    // Obtener API key de OpenAI (RDS `ai_api_config` + fallback env, vía helper
    // agnóstico — sin Supabase).
    const apiKey = await getAiApiKey('openai')
    if (!apiKey) {
      return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
    }
    const openai = new OpenAI({ apiKey })

    // 1. Buscar artículos relevantes
    const searchQuery = lawName
      ? `${questionText} ${lawName} ${articleNumber || ''}`
      : questionText

    const articles = await searchRelevantArticles(openai, searchQuery, lawName)

    // Formatear contexto de artículos
    const articlesContext = articles.length > 0
      ? articles.map(a =>
          `--- ${a.lawShortName || a.lawName} - Artículo ${a.articleNumber} ---\n${a.content}`
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

    // 6. Si hay discrepancia, loguear para revisión.
    // (Se eliminó el INSERT a `question_verifications`: tabla inexistente —no está
    //  en RDS ni tenía datos en Supabase—, envuelto en try/catch que lo tragaba.
    //  Era el único WRITE residual a Supabase, y muerto. 09/07/2026.)
    if (verificationResult.discrepancy) {
      console.log(`⚠️ DISCREPANCIA DETECTADA en pregunta ${questionId}:`)
      console.log(`   BD dice: ${dbAnswerLetter}`)
      console.log(`   AI dice: ${aiAnswer} (confianza: ${confidence})`)
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

export const POST = withErrorLogging('/api/ai/verify-answer', _POST)
