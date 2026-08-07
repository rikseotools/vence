// app/api/exam/resume/route.ts - API para obtener datos de examen a reanudar
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseResumeExamRequest,
  getResumedExamData,
  verifyTestOwnership,
} from '@/lib/api/exam'
import { getAdminDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { orderForQuestion, originalLetterToDisplayed } from '@/lib/shuffle/examOrder'
import { applyOrder } from '@/lib/shuffle/permute'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

/**
 * GET /api/exam/resume?testId=...&userId=...
 *
 * Obtiene datos completos para reanudar un examen.
 * Lee question_ids de tests.questionsMetadata (path nuevo) o
 * de test_questions (fallback legacy para exámenes viejos).
 *
 * Query params:
 * - testId: string (UUID, requerido)
 * - userId: string (UUID, opcional para verificar ownership)
 *
 * Returns:
 * - success: boolean
 * - testId, temaNumber, totalQuestions, answeredCount
 * - questions: preguntas completas (sin correct_option)
 * - savedAnswers: { [index]: answer } para respuestas ya dadas
 */
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const userId = searchParams.get('userId')

    // Validar con Zod
    const parseResult = safeParseResumeExamRequest({ testId, userId: userId || undefined })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || 'Datos inválidos',
        },
        { status: 400 }
      )
    }

    const { testId: validTestId, userId: validUserId } = parseResult.data

    // Si se proporciona userId, verificar propiedad
    if (validUserId) {
      const isOwner = await verifyTestOwnership(validTestId, validUserId)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este examen' },
          { status: 403 }
        )
      }
    }

    // Obtener datos del examen (metadata o legacy)
    const examData = await getResumedExamData(validTestId)

    if (!examData.success) {
      return NextResponse.json(
        { success: false, error: examData.error },
        { status: examData.error === 'Test no encontrado' ? 404 : 400 }
      )
    }

    // Obtener question_ids de las preguntas del examen
    const questionIds = examData.questions
      ?.filter(q => q.questionId)
      .map(q => q.questionId!) ?? []

    if (questionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay preguntas guardadas para reanudar' },
        { status: 400 }
      )
    }

    // Obtener preguntas completas (embed articles→laws → leftJoin + reconstrucción
    // del shape anidado que se pasa tal cual al cliente).
    // SEGURIDAD: NO incluir correct_option - se valida via /api/exam/validate
    let fullQuestions = null
    let questionsError = null
    try {
      const rawQuestions = await getAdminDb()
        .select({
          id: questions.id,
          question_text: questions.questionText,
          option_a: questions.optionA,
          option_b: questions.optionB,
          option_c: questions.optionC,
          option_d: questions.optionD,
          difficulty: questions.difficulty,
          is_official_exam: questions.isOfficialExam,
          primary_article_id: questions.primaryArticleId,
          image_url: questions.imageUrl,
          content_data: questions.contentData,
          art_id: articles.id,
          art_number: articles.articleNumber,
          art_title: articles.title,
          art_content: articles.content,
          law_short_name: laws.shortName,
          law_name: laws.name,
        })
        .from(questions)
        .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
        .leftJoin(laws, eq(articles.lawId, laws.id))
        .where(inArray(questions.id, questionIds))

      fullQuestions = rawQuestions.map(r => ({
        id: r.id,
        question_text: r.question_text,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        difficulty: r.difficulty,
        is_official_exam: r.is_official_exam,
        primary_article_id: r.primary_article_id,
        image_url: r.image_url,
        content_data: r.content_data,
        articles: r.art_id ? {
          id: r.art_id,
          article_number: r.art_number,
          title: r.art_title,
          content: r.art_content,
          laws: (r.law_short_name != null || r.law_name != null)
            ? { short_name: r.law_short_name, name: r.law_name }
            : null,
        } : null,
      }))
    } catch (e) {
      questionsError = e
    }

    if (questionsError) {
      console.error('Error obteniendo preguntas completas:', questionsError)
      return NextResponse.json(
        { success: false, error: 'Error obteniendo preguntas' },
        { status: 500 }
      )
    }

    // Crear mapa de preguntas por ID para acceso rápido
    const questionsMap = new Map(
      (fullQuestions ?? []).map(q => [q.id, q])
    )

    // T-277: si esta pregunta se sirvió barajada/recortada, `option_orders` (grabado UNA
    // vez al crear el examen, leído aquí de tests.questions_metadata) dice el orden. Sin
    // esto, un examen reanudado volvería a mostrar las opciones en orden NATURAL —
    // exactamente la corrupción que esta tarea existe para evitar: el usuario vería otras
    // opciones que las que dejó a medias, y su respuesta ya guardada (en coordenadas
    // originales) dejaría de significar lo mismo en pantalla.
    const optionOrders = examData.optionOrders ?? {}

    // Construir respuesta ordenada con preguntas completas y respuestas
    const orderedQuestions: unknown[] = []
    const savedAnswers: Record<string, string> = {}

    examData.questions?.forEach((savedQ, index) => {
      if (savedQ.questionId && questionsMap.has(savedQ.questionId)) {
        const q = questionsMap.get(savedQ.questionId)!
        const order = orderForQuestion(optionOrders, savedQ.questionId)

        if (order) {
          // Reconstruir en el MISMO orden (o subconjunto) que se sirvió: compactar
          // (quitar huecos, igual que hizo transformQuestion al servir por primera vez),
          // aplicar el orden persistido, y volver a A-D. Un subconjunto (T-267, examen de
          // 3 opciones) da menos de 4 elementos: los slots que sobran quedan null, que es
          // justo como se sirvieron la primera vez.
          const q4 = q as { option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null }
          const natural = [q4.option_a, q4.option_b, q4.option_c, q4.option_d].filter(
            (v): v is string => v != null && v !== ''
          )
          const displayed = applyOrder(natural, order)
          orderedQuestions.push({
            ...q,
            option_a: displayed[0] ?? null,
            option_b: displayed[1] ?? null,
            option_c: displayed[2] ?? null,
            option_d: displayed[3] ?? null,
          })
        } else {
          orderedQuestions.push(q)
        }

        // Guardar respuesta del usuario si existe (no vacía). `test_questions.userAnswer`
        // vive en coordenadas ORIGINALES (ver lib/shuffle/examOrder.ts); se traduce a
        // MOSTRADAS para que cuadre con las opciones reconstruidas arriba.
        if (savedQ.userAnswer && savedQ.userAnswer.trim() !== '') {
          const displayedAnswer = order
            ? originalLetterToDisplayed(order, savedQ.userAnswer.toLowerCase())
            : savedQ.userAnswer.toLowerCase()
          if (displayedAnswer) savedAnswers[index.toString()] = displayedAnswer
        }
      }
    })

    return NextResponse.json({
      success: true,
      testId: examData.testId,
      temaNumber: examData.temaNumber,
      totalQuestions: orderedQuestions.length,
      answeredCount: examData.answeredCount,
      questions: orderedQuestions,
      savedAnswers,
    })
  } catch (error) {
    console.error('Error en API /exam/resume:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/exam/resume', _GET)
