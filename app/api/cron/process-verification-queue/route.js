// app/api/cron/process-verification-queue/route.js
// Cron job que procesa la cola de verificaciones de preguntas

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Número de preguntas a procesar por ejecución (para no exceder timeout de 60s)
const BATCH_SIZE = 10

/**
 * GET /api/cron/process-verification-queue
 * Procesa la siguiente tarea de verificación en la cola
 */
export async function GET(request) {
  try {
    // Verificar cron secret (opcional, para seguridad)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Permitir sin auth en desarrollo
      if (process.env.NODE_ENV === 'production') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 1. Buscar tarea en proceso o tomar la siguiente pendiente
    let { data: task } = await supabase
      .from('verification_queue')
      .select('*')
      .eq('status', 'processing')
      .order('started_at', { ascending: true })
      .limit(1)
      .single()

    // Si no hay ninguna procesándose, tomar la siguiente pendiente
    if (!task) {
      const { data: pendingTask, error: pendingError } = await supabase
        .from('verification_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (pendingError || !pendingTask) {
        return Response.json({
          success: true,
          message: 'No hay verificaciones pendientes',
          processed: 0
        })
      }

      // Marcar como processing
      const { data: updatedTask, error: updateError } = await supabase
        .from('verification_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', pendingTask.id)
        .eq('status', 'pending') // Evitar race conditions
        .select()
        .single()

      if (updateError || !updatedTask) {
        return Response.json({
          success: false,
          error: 'No se pudo iniciar la tarea (posible race condition)'
        })
      }

      task = updatedTask
    }

    // 2. Obtener las preguntas pendientes de este tema
    const pendingQuestionIds = await getPendingQuestionIds(task)

    if (pendingQuestionIds.length === 0) {
      // Ya no hay pendientes, marcar como completada
      await supabase
        .from('verification_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', task.id)

      return Response.json({
        success: true,
        message: 'Verificación completada',
        task_id: task.id,
        total_processed: task.processed_questions
      })
    }

    // 3. Tomar un lote de preguntas
    const batch = pendingQuestionIds.slice(0, BATCH_SIZE)

    // 4. Llamar a la API de verificación existente
    // Determinar base URL según entorno
    const getBaseUrl = () => {
      // 1. Usar variable explícita si está configurada
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL
      }
      // 2. En Vercel producción, usar URL de producción
      if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      }
      // 3. En Vercel preview/development, usar URL del deployment
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`
      }
      // 4. Fallback a localhost
      return 'http://localhost:3000'
    }
    const verifyResponse = await fetch(
      `${getBaseUrl()}/api/topic-review/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: batch,
          provider: task.ai_provider,
          model: task.ai_model
        })
      }
    )

    const verifyResult = await verifyResponse.json()

    // 5. Actualizar progreso
    const newProcessed = task.processed_questions + batch.length
    const newSuccessful = task.successful_verifications + (verifyResult.results?.length || 0)
    const newFailed = task.failed_verifications + (verifyResult.errors?.length || 0)

    // Verificar si terminamos
    const isComplete = newProcessed >= task.total_questions ||
                       pendingQuestionIds.length <= BATCH_SIZE

    await supabase
      .from('verification_queue')
      .update({
        processed_questions: newProcessed,
        successful_verifications: newSuccessful,
        failed_verifications: newFailed,
        status: isComplete ? 'completed' : 'processing',
        completed_at: isComplete ? new Date().toISOString() : null
      })
      .eq('id', task.id)

    return Response.json({
      success: true,
      task_id: task.id,
      topic_id: task.topic_id,
      batch_size: batch.length,
      processed: newProcessed,
      total: task.total_questions,
      successful: newSuccessful,
      failed: newFailed,
      is_complete: isComplete,
      remaining: pendingQuestionIds.length - batch.length
    })

  } catch (error) {
    console.error('Error en process-verification-queue:', error)

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * Obtiene los IDs de preguntas pendientes de verificar para una tarea
 */
async function getPendingQuestionIds(task) {
  // Si hay IDs específicos, filtrar los que aún están pendientes
  if (task.question_ids && task.question_ids.length > 0) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .in('id', task.question_ids)
      .eq('is_active', true)
      .or('topic_review_status.is.null,topic_review_status.eq.pending')

    return questions?.map(q => q.id) || []
  }

  // Si no, obtener todas las pendientes del tema
  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select('article_numbers, laws(id)')
    .eq('topic_id', task.topic_id)

  let articleIds = []
  for (const scope of topicScopes || []) {
    if (!scope.laws?.id || !scope.article_numbers?.length) continue

    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.laws.id)
      .in('article_number', scope.article_numbers)

    if (articles) {
      articleIds.push(...articles.map(a => a.id))
    }
  }

  if (articleIds.length === 0) return []

  // Obtener preguntas pendientes en lotes para evitar límites
  const allPendingIds = []
  const batchSize = 50

  for (let i = 0; i < articleIds.length; i += batchSize) {
    const batch = articleIds.slice(i, i + batchSize)
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .in('primary_article_id', batch)
      .eq('is_active', true)
      .or('topic_review_status.is.null,topic_review_status.eq.pending')

    if (questions) {
      allPendingIds.push(...questions.map(q => q.id))
    }
  }

  return allPendingIds
}
