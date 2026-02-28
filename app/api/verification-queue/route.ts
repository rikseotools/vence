import { NextRequest, NextResponse } from 'next/server'
import { verificationQueuePostSchema } from '@/lib/api/verify-articles/schemas'
import {
  getVerificationQueueEntries,
  getExistingQueueEntry,
  getTopicById,
  getTopicScopesByTopic,
  getArticlesByLawAndNumbers,
  insertQueueEntry,
  cancelQueueEntry,
} from '@/lib/api/verify-articles/queries'
import { getDb } from '@/db/client'
import { questions } from '@/db/schema'
import { and, eq, inArray, or, isNull, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id') || undefined
    const status = searchParams.get('status') || undefined

    const data = await getVerificationQueueEntries({ topicId, status })

    return NextResponse.json({ success: true, queue: data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = verificationQueuePostSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { topic_id, provider, model, question_ids } = validation.data

    const topic = await getTopicById(topic_id)
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Tema no encontrado' }, { status: 404 })
    }

    const existing = await getExistingQueueEntry(topic_id)
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya hay una verificación ${existing.status === 'pending' ? 'pendiente' : 'en proceso'} para este tema`,
          existing_id: existing.id,
        },
        { status: 409 }
      )
    }

    let totalQuestions = question_ids?.length || 0

    if (!question_ids || question_ids.length === 0) {
      const topicScopes = await getTopicScopesByTopic(topic_id)

      const articleIds: string[] = []
      for (const scope of topicScopes) {
        if (!scope.lawId || !scope.articleNumbers?.length) continue
        const arts = await getArticlesByLawAndNumbers(scope.lawId, scope.articleNumbers)
        articleIds.push(...arts.map(a => a.id))
      }

      if (articleIds.length > 0) {
        const db = getDb()
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(questions)
          .where(
            and(
              inArray(questions.primaryArticleId, articleIds),
              eq(questions.isActive, true),
              or(isNull(questions.topicReviewStatus), eq(questions.topicReviewStatus, 'pending'))
            )
          )
        totalQuestions = result[0]?.count ?? 0
      }
    }

    if (totalQuestions === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay preguntas pendientes de verificar en este tema' },
        { status: 400 }
      )
    }

    const queueEntry = await insertQueueEntry({
      topicId: topic_id,
      aiProvider: provider,
      aiModel: model,
      questionIds: question_ids || [],
      totalQuestions,
      status: 'pending',
    })

    return NextResponse.json({
      success: true,
      message: `Verificación encolada: ${totalQuestions} preguntas pendientes`,
      queue_entry: queueEntry,
      topic: { id: topic.id, title: topic.title, topic_number: topic.topicNumber },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Se requiere id' }, { status: 400 })
    }

    const data = await cancelQueueEntry(id)

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No se pudo cancelar (puede que ya esté procesándose)' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verificación cancelada',
      cancelled: data,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
