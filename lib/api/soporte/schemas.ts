// lib/api/soporte/schemas.ts - Schemas de validación para página de soporte
import { z } from 'zod/v3'

// ============================================
// FEEDBACK CON CONVERSACIÓN
// ============================================

export const feedbackWithConversationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  message: z.string(),
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
  conversation: z.object({
    id: z.string().uuid(),
    status: z.string().nullable(),
    lastMessageAt: z.string().nullable(),
    lastMessage: z.string().nullable().optional(),
    lastMessageIsAdmin: z.boolean().nullable().optional(),
    messageCount: z.number().optional(),
  }).nullable(),
})

export type FeedbackWithConversation = z.infer<typeof feedbackWithConversationSchema>

// ============================================
// RESPONSE: DATOS DE SOPORTE
// ============================================

export const soporteDataResponseSchema = z.object({
  success: z.boolean(),
  feedbacks: z.array(feedbackWithConversationSchema),
  disputes: z.array(z.object({
    id: z.string().uuid(),
    disputeType: z.string(),
    description: z.string(),
    status: z.string().nullable(),
    createdAt: z.string().nullable(),
    resolvedAt: z.string().nullable(),
    adminResponse: z.string().nullable(),
    appealText: z.string().nullable().optional(),
    appealSubmittedAt: z.string().nullable().optional(),
    isRead: z.boolean().nullable(),
    isPsychometric: z.boolean(),
    question: z.object({
      questionText: z.string(),
      optionA: z.string().nullable(),
      optionB: z.string().nullable(),
      optionC: z.string().nullable(),
      optionD: z.string().nullable(),
      correctOption: z.number().nullable(),
      explanation: z.string().nullable(),
      questionSubtype: z.string().nullable().optional(),
      solutionSteps: z.string().nullable().optional(),
      contentData: z.any().optional(),
      article: z.object({
        articleNumber: z.string(),
        title: z.string().nullable(),
        content: z.string().nullable(),
        lawShortName: z.string().nullable(),
      }).nullable().optional(),
    }).nullable(),
  })),
  error: z.string().optional(),
})

export type SoporteDataResponse = z.infer<typeof soporteDataResponseSchema>

// ============================================
// RESPONSE: MENSAJES DE CONVERSACIÓN
// ============================================

export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  message: z.string(),
  isAdmin: z.boolean().nullable(),
  createdAt: z.string().nullable(),
  senderName: z.string().nullable(),
  senderEmail: z.string().nullable(),
})

export type ConversationMessage = z.infer<typeof conversationMessageSchema>

export const conversationMessagesResponseSchema = z.object({
  success: z.boolean(),
  messages: z.array(conversationMessageSchema),
  error: z.string().optional(),
})

export type ConversationMessagesResponse = z.infer<typeof conversationMessagesResponseSchema>
