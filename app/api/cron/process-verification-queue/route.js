// app/api/cron/process-verification-queue/route.js
// Cron job que procesa la cola de verificaciones de preguntas
// Procesa múltiples batches en una sola ejecución hasta completar o timeout

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Número de preguntas a procesar por batch
const BATCH_SIZE = 5

// Tiempo máximo de ejecución (50 segundos para dejar margen antes del timeout de 60s)
const MAX_EXECUTION_TIME_MS = 50000

/**
 * GET /api/cron/process-verification-queue
 * Procesa la siguiente tarea de verificación en la cola
 * Continúa procesando batches hasta completar o alcanzar el timeout
 */
export async function GET(request) {
  const startTime = Date.now()

  try {
    // Verificar autorización (igual que otros cron endpoints)
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Buscar tarea en proceso o tomar la siguiente pendiente
    let { data: task } = await getSupabase()
      .from('verification_queue')
      .select('*')
      .eq('status', 'processing')
      .order('started_at', { ascending: true })
      .limit(1)
      .single()

    // Si no hay ninguna procesándose, tomar la siguiente pendiente
    if (!task) {
      const { data: pendingTask, error: pendingError } = await getSupabase()
        .from('verification_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (pendingError || !pendingTask) {
        return NextResponse.json({
          success: true,
          message: 'No hay verificaciones pendientes',
          processed: 0
        })
      }

      // Marcar como processing
      const { data: updatedTask, error: updateError } = await getSupabase()
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
        return NextResponse.json({
          success: false,
          error: 'No se pudo iniciar la tarea (posible race condition)'
        })
      }

      task = updatedTask
    }

    // Determinar base URL según entorno
    const getBaseUrl = () => {
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL
      }
      if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      }
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`
      }
      return 'http://localhost:3000'
    }

    const baseUrl = getBaseUrl()
    let totalProcessedThisRun = 0
    let totalSuccessfulThisRun = 0
    let totalFailedThisRun = 0
    let batchesProcessed = 0
    let isComplete = false
    let billingError = false

    // 2. Procesar batches en loop hasta completar o timeout
    while (!isComplete && !billingError) {
      // Verificar si nos acercamos al timeout
      const elapsed = Date.now() - startTime
      if (elapsed > MAX_EXECUTION_TIME_MS) {
        console.log(`⏰ Timeout alcanzado después de ${batchesProcessed} batches (${elapsed}ms)`)
        break
      }

      // Obtener las preguntas pendientes de este tema
      const pendingQuestionIds = await getPendingQuestionIds(task)

      if (pendingQuestionIds.length === 0) {
        isComplete = true
        break
      }

      // Tomar un lote de preguntas
      const batch = pendingQuestionIds.slice(0, BATCH_SIZE)
      console.log(`📦 Procesando batch ${batchesProcessed + 1}: ${batch.length} preguntas`)

      // Llamar a la API de verificación
      const verifyResponse = await fetch(
        `${baseUrl}/api/topic-review/verify`,
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

      // Detectar error de billing/créditos
      if (!verifyResult.success && verifyResult.errorType === 'billing') {
        console.error(`🛑 Error de billing: ${verifyResult.error}`)
        billingError = true

        // Marcar la tarea como fallida
        await getSupabase()
          .from('verification_queue')
          .update({
            status: 'failed',
            error_message: verifyResult.error,
            completed_at: new Date().toISOString()
          })
          .eq('id', task.id)

        break
      }

      // Actualizar contadores
      const batchSuccessful = verifyResult.results?.length || 0
      const batchFailed = verifyResult.errors?.length || 0

      totalProcessedThisRun += batch.length
      totalSuccessfulThisRun += batchSuccessful
      totalFailedThisRun += batchFailed
      batchesProcessed++

      // Actualizar progreso en BD
      const newProcessed = task.processed_questions + totalProcessedThisRun
      const newSuccessful = task.successful_verifications + totalSuccessfulThisRun
      const newFailed = task.failed_verifications + totalFailedThisRun

      // Verificar si terminamos (usamos pendingQuestionIds.length porque es dinámico)
      isComplete = pendingQuestionIds.length <= batch.length

      await getSupabase()
        .from('verification_queue')
        .update({
          processed_questions: newProcessed,
          successful_verifications: newSuccessful,
          failed_verifications: newFailed,
          status: isComplete ? 'completed' : 'processing',
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', task.id)

      // Pequeña pausa entre batches para no saturar
      if (!isComplete) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Recargar task para obtener valores actualizados
    const { data: finalTask } = await getSupabase()
      .from('verification_queue')
      .select('*')
      .eq('id', task.id)
      .single()

    return NextResponse.json({
      success: !billingError,
      task_id: task.id,
      topic_id: task.topic_id,
      batches_processed: batchesProcessed,
      processed_this_run: totalProcessedThisRun,
      processed_total: finalTask?.processed_questions || 0,
      total: finalTask?.total_questions || task.total_questions,
      successful: finalTask?.successful_verifications || 0,
      failed: finalTask?.failed_verifications || 0,
      is_complete: isComplete,
      billing_error: billingError,
      execution_time_ms: Date.now() - startTime
    })

  } catch (error) {
    console.error('Error en process-verification-queue:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      execution_time_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * Obtiene los IDs de preguntas pendientes de verificar para una tarea
 */
async function getPendingQuestionIds(task) {
  // Si hay IDs específicos, filtrar los que aún están pendientes
  if (task.question_ids && task.question_ids.length > 0) {
    const { data: questions } = await getSupabase()
      .from('questions')
      .select('id')
      .in('id', task.question_ids)
      .eq('is_active', true)
      .or('topic_review_status.is.null,topic_review_status.eq.pending')

    return questions?.map(q => q.id) || []
  }

  // Si no, obtener todas las pendientes del tema
  const { data: topicScopes } = await getSupabase()
    .from('topic_scope')
    .select('article_numbers, laws(id)')
    .eq('topic_id', task.topic_id)

  let articleIds = []
  for (const scope of topicScopes || []) {
    if (!scope.laws?.id || !scope.article_numbers?.length) continue

    const { data: articles } = await getSupabase()
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
    const { data: questions } = await getSupabase()
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
