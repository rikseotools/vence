// lib/api/soporte/queries.ts - Queries tipadas para página de soporte
import { getDb } from '@/db/client'
import {
  userFeedback,
  feedbackConversations,
  feedbackMessages,
  questionDisputes,
  psychometricQuestionDisputes,
  questions,
  articles,
  laws,
  psychometricQuestions,
  userProfiles,
} from '@/db/schema'
import { eq, desc, ne, and, asc } from 'drizzle-orm'
import type {
  FeedbackWithConversation,
  ConversationMessage,
} from './schemas'

// ============================================
// FEEDBACKS CON CONVERSACIONES
// ============================================

export async function getUserFeedbacksWithConversations(
  userId: string
): Promise<FeedbackWithConversation[]> {
  const db = getDb()

  // Obtener feedbacks (excluyendo question_dispute)
  const feedbackRows = await db
    .select({
      id: userFeedback.id,
      type: userFeedback.type,
      message: userFeedback.message,
      status: userFeedback.status,
      createdAt: userFeedback.createdAt,
    })
    .from(userFeedback)
    .where(and(
      eq(userFeedback.userId, userId),
      ne(userFeedback.type, 'question_dispute')
    ))
    .orderBy(desc(userFeedback.createdAt))

  if (feedbackRows.length === 0) {
    return []
  }

  // Obtener conversaciones del usuario
  const conversationRows = await db
    .select({
      id: feedbackConversations.id,
      feedbackId: feedbackConversations.feedbackId,
      status: feedbackConversations.status,
      lastMessageAt: feedbackConversations.lastMessageAt,
    })
    .from(feedbackConversations)
    .where(eq(feedbackConversations.userId, userId))
    .orderBy(desc(feedbackConversations.lastMessageAt))

  // Map conversations by feedbackId
  const convByFeedbackId = new Map<string, typeof conversationRows[0]>()
  for (const conv of conversationRows) {
    if (conv.feedbackId) {
      convByFeedbackId.set(conv.feedbackId, conv)
    }
  }

  return feedbackRows.map(fb => ({
    id: fb.id,
    type: fb.type,
    message: fb.message,
    status: fb.status,
    createdAt: fb.createdAt,
    conversation: convByFeedbackId.has(fb.id)
      ? {
          id: convByFeedbackId.get(fb.id)!.id,
          status: convByFeedbackId.get(fb.id)!.status,
          lastMessageAt: convByFeedbackId.get(fb.id)!.lastMessageAt,
        }
      : null,
  }))
}

// ============================================
// MENSAJES DE CONVERSACIÓN
// ============================================

export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; messages: ConversationMessage[]; error?: string }> {
  const db = getDb()

  // Verificar que la conversación pertenece al usuario
  const convRows = await db
    .select({
      id: feedbackConversations.id,
      userId: feedbackConversations.userId,
    })
    .from(feedbackConversations)
    .where(eq(feedbackConversations.id, conversationId))
    .limit(1)

  const conv = convRows[0]
  if (!conv) {
    return { success: false, messages: [], error: 'Conversación no encontrada' }
  }
  if (conv.userId !== userId) {
    return { success: false, messages: [], error: 'No tienes permiso para esta conversación' }
  }

  // Obtener mensajes con datos del sender
  const messageRows = await db
    .select({
      id: feedbackMessages.id,
      message: feedbackMessages.message,
      isAdmin: feedbackMessages.isAdmin,
      createdAt: feedbackMessages.createdAt,
      senderName: userProfiles.fullName,
      senderEmail: userProfiles.email,
    })
    .from(feedbackMessages)
    .leftJoin(userProfiles, eq(feedbackMessages.senderId, userProfiles.id))
    .where(eq(feedbackMessages.conversationId, conversationId))
    .orderBy(asc(feedbackMessages.createdAt))

  return {
    success: true,
    messages: messageRows.map(m => ({
      id: m.id,
      message: m.message,
      isAdmin: m.isAdmin,
      createdAt: m.createdAt,
      senderName: m.senderName ?? null,
      senderEmail: m.senderEmail ?? null,
    })),
  }
}

// ============================================
// IMPUGNACIONES (NORMALES + PSICOTÉCNICAS)
// ============================================

interface DisputeRow {
  id: string
  disputeType: string
  description: string
  status: string | null
  createdAt: string | null
  resolvedAt: string | null
  adminResponse: string | null
  appealText?: string | null
  appealSubmittedAt?: string | null
  isRead: boolean | null
  isPsychometric: boolean
  question: {
    questionText: string
    optionA: string | null
    optionB: string | null
    optionC: string | null
    optionD: string | null
    correctOption: number | null
    explanation: string | null
    questionSubtype?: string | null
    solutionSteps?: string | null
    contentData?: unknown
    article?: {
      articleNumber: string
      title: string | null
      content: string | null
      lawShortName: string | null
    } | null
  } | null
}

export async function getUserDisputes(userId: string): Promise<DisputeRow[]> {
  const db = getDb()

  // 1. Impugnaciones normales con question → article → law
  const normalRows = await db
    .select({
      id: questionDisputes.id,
      disputeType: questionDisputes.disputeType,
      description: questionDisputes.description,
      status: questionDisputes.status,
      createdAt: questionDisputes.createdAt,
      resolvedAt: questionDisputes.resolvedAt,
      adminResponse: questionDisputes.adminResponse,
      appealText: questionDisputes.appealText,
      appealSubmittedAt: questionDisputes.appealSubmittedAt,
      isRead: questionDisputes.isRead,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      articleNumber: articles.articleNumber,
      articleTitle: articles.title,
      articleContent: articles.content,
      lawShortName: laws.shortName,
    })
    .from(questionDisputes)
    .innerJoin(questions, eq(questionDisputes.questionId, questions.id))
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(eq(questionDisputes.userId, userId))
    .orderBy(desc(questionDisputes.createdAt))

  const normalDisputes: DisputeRow[] = normalRows.map(r => ({
    id: r.id,
    disputeType: r.disputeType,
    description: r.description,
    status: r.status,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    adminResponse: r.adminResponse,
    appealText: r.appealText,
    appealSubmittedAt: r.appealSubmittedAt,
    isRead: r.isRead,
    isPsychometric: false,
    question: {
      questionText: r.questionText,
      optionA: r.optionA,
      optionB: r.optionB,
      optionC: r.optionC,
      optionD: r.optionD,
      correctOption: r.correctOption,
      explanation: r.explanation,
      article: {
        articleNumber: r.articleNumber,
        title: r.articleTitle,
        content: r.articleContent,
        lawShortName: r.lawShortName,
      },
    },
  }))

  // 2. Impugnaciones psicotécnicas
  const psychoRows = await db
    .select({
      id: psychometricQuestionDisputes.id,
      disputeType: psychometricQuestionDisputes.disputeType,
      description: psychometricQuestionDisputes.description,
      status: psychometricQuestionDisputes.status,
      createdAt: psychometricQuestionDisputes.createdAt,
      resolvedAt: psychometricQuestionDisputes.resolvedAt,
      adminResponse: psychometricQuestionDisputes.adminResponse,
      isRead: psychometricQuestionDisputes.isRead,
      questionText: psychometricQuestions.questionText,
      questionSubtype: psychometricQuestions.questionSubtype,
      optionA: psychometricQuestions.optionA,
      optionB: psychometricQuestions.optionB,
      optionC: psychometricQuestions.optionC,
      optionD: psychometricQuestions.optionD,
      correctOption: psychometricQuestions.correctOption,
      explanation: psychometricQuestions.explanation,
      solutionSteps: psychometricQuestions.solutionSteps,
      contentData: psychometricQuestions.contentData,
    })
    .from(psychometricQuestionDisputes)
    .innerJoin(psychometricQuestions, eq(psychometricQuestionDisputes.questionId, psychometricQuestions.id))
    .where(eq(psychometricQuestionDisputes.userId, userId))
    .orderBy(desc(psychometricQuestionDisputes.createdAt))

  const psychoDisputes: DisputeRow[] = psychoRows.map(r => ({
    id: r.id,
    disputeType: r.disputeType,
    description: r.description,
    status: r.status,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    adminResponse: r.adminResponse,
    isRead: r.isRead,
    isPsychometric: true,
    question: {
      questionText: r.questionText,
      optionA: r.optionA,
      optionB: r.optionB,
      optionC: r.optionC,
      optionD: r.optionD,
      correctOption: r.correctOption,
      explanation: r.explanation,
      questionSubtype: r.questionSubtype,
      solutionSteps: r.solutionSteps,
      contentData: r.contentData,
    },
  }))

  // 3. Combinar y ordenar por fecha
  return [...normalDisputes, ...psychoDisputes].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return dateB - dateA
  })
}
