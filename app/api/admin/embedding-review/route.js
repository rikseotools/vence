// app/api/admin/embedding-review/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  try {
    // Obtener preguntas marcadas por embedding similarity con article_ok = false
    const { data: verifications, error: verError } = await getSupabase()
      .from('ai_verification_results')
      .select(`
        id,
        question_id,
        article_ok,
        confidence,
        correct_article_suggestion,
        explanation,
        verified_at
      `)
      .eq('ai_provider', 'embedding_similarity')
      .eq('article_ok', false)
      .order('verified_at', { ascending: false })

    if (verError) {
      return NextResponse.json({ success: false, error: verError.message })
    }

    if (!verifications || verifications.length === 0) {
      return NextResponse.json({
        success: true,
        questions: [],
        stats: { total: 0, withTopic: 0, withoutTopic: 0 }
      })
    }

    // Obtener datos de las preguntas
    const questionIds = verifications.map(v => v.question_id)
    const { data: questions, error: qError } = await getSupabase()
      .from('questions')
      .select(`
        id,
        question_text,
        primary_article_id,
        topic_review_status,
        articles!primary_article_id (
          id,
          article_number,
          laws (short_name)
        )
      `)
      .in('id', questionIds)

    if (qError) {
      return NextResponse.json({ success: false, error: qError.message })
    }

    // Crear mapa de preguntas
    const questionMap = {}
    questions?.forEach(q => {
      questionMap[q.id] = q
    })

    // Obtener topics de cada pregunta (una pregunta puede estar en varios topics)
    const { data: testQuestions, error: tqError } = await getSupabase()
      .from('test_questions')
      .select(`
        question_id,
        topic_id,
        topics (
          id,
          title,
          topic_number,
          position
        )
      `)
      .in('question_id', questionIds)

    if (tqError) {
      console.error('Error obteniendo topics:', tqError.message)
    }

    // Agrupar topics por pregunta
    const topicsByQuestion = {}
    testQuestions?.forEach(tq => {
      if (!topicsByQuestion[tq.question_id]) {
        topicsByQuestion[tq.question_id] = []
      }
      if (tq.topics) {
        topicsByQuestion[tq.question_id].push({
          topic_id: tq.topic_id,
          topic_title: tq.topics.title,
          topic_number: tq.topics.topic_number,
          position: tq.topics.position
        })
      }
    })

    // Construir respuesta
    const result = verifications.map(v => {
      const q = questionMap[v.question_id] || {}
      const topics = topicsByQuestion[v.question_id] || []

      // Parsear explicación JSON para obtener similitud sugerida
      let suggestedSimilarity = null
      try {
        const explanation = JSON.parse(v.explanation || '{}')
        suggestedSimilarity = explanation.suggestedSimilarity
          ? Math.round(explanation.suggestedSimilarity * 100)
          : null
      } catch (e) {
        // Ignorar error de parseo
      }

      // Extraer porcentaje de confidence
      const similarity = v.confidence
        ? Math.round(parseFloat(v.confidence))
        : 0

      return {
        id: v.question_id,
        question_text: q.question_text || 'Pregunta no encontrada',
        assigned_article: q.articles
          ? `${q.articles.laws?.short_name || '?'} Art. ${q.articles.article_number}`
          : 'N/A',
        similarity,
        suggested_article: v.correct_article_suggestion || null,
        suggested_similarity: suggestedSimilarity,
        topics,
        verified_at: v.verified_at,
        topic_review_status: q.topic_review_status
      }
    })

    // Calcular stats
    const withTopic = result.filter(r => r.topics.length > 0).length
    const withoutTopic = result.filter(r => r.topics.length === 0).length

    return NextResponse.json({
      success: true,
      questions: result,
      stats: {
        total: result.length,
        withTopic,
        withoutTopic
      }
    })

  } catch (error) {
    console.error('Error en embedding-review GET:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { questionId, action } = body

    if (!questionId || !action) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' })
    }

    if (action === 'mark_correct') {
      // Actualizar ai_verification_results para marcar como correcto
      const { error: updateError } = await getSupabase()
        .from('ai_verification_results')
        .update({
          article_ok: true,
          verified_at: new Date().toISOString()
        })
        .eq('question_id', questionId)
        .eq('ai_provider', 'embedding_similarity')

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message })
      }

      // Limpiar topic_review_status de la pregunta si estaba en wrong_article
      await getSupabase()
        .from('questions')
        .update({
          topic_review_status: null,
          verification_status: null
        })
        .eq('id', questionId)
        .eq('topic_review_status', 'wrong_article')

      return NextResponse.json({ success: true, message: 'Marcado como correcto' })

    } else if (action === 'needs_llm_review') {
      // Mantener wrong_article pero añadir flag para revisión LLM
      const { error: updateError } = await getSupabase()
        .from('questions')
        .update({
          topic_review_status: 'wrong_article',
          verification_status: 'needs_llm_review'
        })
        .eq('id', questionId)

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message })
      }

      return NextResponse.json({ success: true, message: 'Marcado para revisión LLM' })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' })

  } catch (error) {
    console.error('Error en embedding-review POST:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}
