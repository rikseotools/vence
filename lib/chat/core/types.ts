// lib/chat/core/types.ts
// Tipos centrales del sistema de chat

import { z } from 'zod'

// ============================================
// Schemas de entrada
// ============================================

export const questionContextSchema = z.object({
  // IDs - acepta tanto 'id' como 'questionId' del frontend
  id: z.string().nullable().optional(),
  questionId: z.string().nullable().optional(),
  questionText: z.string().nullable().optional(),
  // Options puede ser array o objeto {a,b,c,d} del frontend
  options: z.union([
    z.array(z.string()),
    z.object({
      a: z.string().optional(),
      b: z.string().optional(),
      c: z.string().optional(),
      d: z.string().optional(),
    }),
  ]).nullable().optional(),
  // Acepta número (0-3), string ('A'-'D'), o null
  selectedAnswer: z.union([z.number(), z.string()]).nullable().optional(),
  correctAnswer: z.union([z.number(), z.string()]).nullable().optional(),
  lawName: z.string().nullable().optional(),
  articleNumber: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  // Campos adicionales del frontend
  difficulty: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  isPsicotecnico: z.boolean().optional(),
  questionSubtype: z.string().nullable().optional(),
  questionTypeName: z.string().nullable().optional(),
  contentData: z.any().nullable().optional(),
})

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  domain: z.string().optional(),
  questionContext: questionContextSchema.optional(),
  conversationId: z.string().uuid().optional(),
  isPremium: z.boolean().optional().default(false),
})

// ============================================
// Tipos inferidos de schemas
// ============================================

export type QuestionContext = z.infer<typeof questionContextSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatRequest = z.infer<typeof chatRequestSchema>

// ============================================
// Tipos de respuesta
// ============================================

export interface ChatResponse {
  content: string
  metadata?: ChatResponseMetadata
}

export interface ChatResponseMetadata {
  domain: string
  sources?: ArticleSource[]
  verificationResult?: VerificationResult
  processingTime?: number
}

export interface ArticleSource {
  lawName: string
  articleNumber: string
  title?: string
  relevance?: number
}

export interface VerificationResult {
  isCorrect: boolean
  correctAnswer?: number
  explanation?: string
  articleReference?: string
}

// ============================================
// Tipos de dominio
// ============================================

export interface ChatDomain {
  name: string
  priority: number
  canHandle(context: ChatContext): Promise<boolean>
  handle(context: ChatContext): Promise<ChatResponse>
}

// ============================================
// Contexto de chat
// ============================================

export interface ChatContext {
  // Request original
  request: ChatRequest

  // Usuario
  userId: string
  userName?: string
  userDomain: string
  isPremium: boolean

  // Contexto de pregunta (si existe)
  questionContext?: QuestionContext

  // Historial de mensajes
  messages: ChatMessage[]
  currentMessage: string

  // Metadata
  conversationId?: string
  startTime: number
}

// ============================================
// Tipos de búsqueda
// ============================================

export interface ArticleMatch {
  id: string
  lawId: string
  lawName: string
  lawShortName: string
  articleNumber: string
  title: string | null
  content: string
  similarity?: number
}

export interface SearchOptions {
  limit?: number
  minSimilarity?: number
  lawId?: string
  onlyActive?: boolean
}

export interface EmbeddingResult {
  embedding: number[]
  model: string
  tokens: number
}

// ============================================
// Tipos de patrones detectados
// ============================================

export type PatternType =
  | 'plazo'
  | 'recurso'
  | 'organo'
  | 'procedimiento'
  | 'sancion'
  | 'requisito'
  | 'competencia'
  | 'general'

export interface DetectedPattern {
  type: PatternType
  confidence: number
  keywords: string[]
  suggestedLaws?: string[]
}

// ============================================
// Tipos de streaming
// ============================================

export interface StreamChunk {
  type: 'text' | 'metadata' | 'error' | 'done'
  content?: string
  metadata?: ChatResponseMetadata
  error?: string
}

export type StreamHandler = (chunk: StreamChunk) => void

// ============================================
// Tipos de rate limiting
// ============================================

export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime?: Date
  dailyUsed: number
  dailyLimit: number
}

// ============================================
// Constantes
// ============================================

export const DOMAIN_PRIORITIES = {
  VERIFICATION: 1,
  KNOWLEDGE_BASE: 2,
  SEARCH: 3,
  STATS: 4,
  FALLBACK: 99,
} as const

export const MAX_CONTEXT_MESSAGES = 10
export const MAX_MESSAGE_LENGTH = 4000
export const DEFAULT_SEARCH_LIMIT = 30
