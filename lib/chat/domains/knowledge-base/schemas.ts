// lib/chat/domains/knowledge-base/schemas.ts
// Schemas Zod para el dominio de Knowledge Base

import { z } from 'zod'

// ============================================
// SCHEMAS DE KB
// ============================================

export const kbCategorySchema = z.enum([
  'planes',
  'funcionalidades',
  'faq',
  'plataforma',
  'oposiciones',
])

export type KBCategorySchema = z.infer<typeof kbCategorySchema>

export const knowledgeBaseEntrySchema = z.object({
  id: z.string().uuid(),
  category: kbCategorySchema,
  subcategory: z.string().nullable(),
  title: z.string(),
  content: z.string(),
  shortAnswer: z.string().nullable(),
  keywords: z.array(z.string()),
  priority: z.number().int(),
  similarity: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type KnowledgeBaseEntrySchema = z.infer<typeof knowledgeBaseEntrySchema>

export const kbSearchResultSchema = z.object({
  entries: z.array(knowledgeBaseEntrySchema),
  category: kbCategorySchema.nullable(),
  searchMethod: z.enum(['semantic', 'keywords', 'none']),
  confidence: z.number().min(0).max(1),
})

export type KBSearchResultSchema = z.infer<typeof kbSearchResultSchema>

// ============================================
// SCHEMAS DE BÚSQUEDA
// ============================================

export const kbSearchOptionsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.40),
  limit: z.number().int().positive().max(10).default(3),
  category: kbCategorySchema.nullable().default(null),
})

export type KBSearchOptionsSchema = z.infer<typeof kbSearchOptionsSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateKBEntry(data: unknown): KnowledgeBaseEntrySchema {
  return knowledgeBaseEntrySchema.parse(data)
}

export function validateKBSearchResult(data: unknown): KBSearchResultSchema {
  return kbSearchResultSchema.parse(data)
}

export function safeValidateKBEntry(data: unknown) {
  return knowledgeBaseEntrySchema.safeParse(data)
}
