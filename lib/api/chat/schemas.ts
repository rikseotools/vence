// lib/api/chat/schemas.ts - Schemas de validación para el chat AI
import { z } from 'zod'

// Schema para el request del chat
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(5000, 'Mensaje muy largo'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional().default([]),
  questionContext: z.object({
    question: z.string().optional(),
    options: z.record(z.string()).optional(),
    correctAnswer: z.string().optional(),
    userAnswer: z.string().optional(),
    explanation: z.string().optional(),
    articleNumber: z.string().optional(),
    lawName: z.string().optional(),
    isPsicotecnico: z.boolean().optional()
  }).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  userOposicion: z.string().optional().nullable(),
  isPremium: z.boolean().optional().default(false)
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

// Schema para la respuesta del chat
export const chatResponseSchema = z.object({
  success: z.boolean(),
  response: z.string().optional(),
  sources: z.array(z.object({
    article: z.string(),
    law: z.string(),
    lawName: z.string().optional(),
    content: z.string().optional()
  })).optional(),
  offerTest: z.boolean().optional(),
  testLaws: z.array(z.object({
    shortName: z.string(),
    name: z.string().optional()
  })).optional(),
  followUpQuestions: z.array(z.object({
    text: z.string(),
    label: z.string()
  })).optional(),
  error: z.string().optional(),
  limitReached: z.boolean().optional(),
  dailyCount: z.number().optional(),
  limit: z.number().optional()
})

export type ChatResponse = z.infer<typeof chatResponseSchema>

// Validar request y devolver datos tipados o errores
export function validateChatRequest(body: unknown):
  | { success: true; data: ChatRequest }
  | { success: false; errors: z.ZodIssue[] } {
  const result = chatRequestSchema.safeParse(body)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: result.error.issues }
}
