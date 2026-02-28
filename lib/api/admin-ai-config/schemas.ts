// lib/api/admin-ai-config/schemas.ts - Schemas para configuración de APIs de IA
import { z } from 'zod/v3'

// ============================================
// REQUEST: UPDATE CONFIG
// ============================================

export const updateAiConfigRequestSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateAiConfigRequest = z.infer<typeof updateAiConfigRequestSchema>

// ============================================
// REQUEST: TEST CONFIG
// ============================================

export const testAiConfigRequestSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  testAllModels: z.boolean().optional(),
})

export type TestAiConfigRequest = z.infer<typeof testAiConfigRequestSchema>

// ============================================
// RESPONSE: GET CONFIGS
// ============================================

export const aiConfigResponseSchema = z.object({
  success: z.boolean(),
  configs: z.array(z.object({
    provider: z.string(),
    is_active: z.boolean(),
    default_model: z.string().nullable(),
    available_models: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string(),
      error: z.string().nullable().optional(),
    })),
    has_key: z.boolean(),
    api_key_hint: z.string().nullable(),
    last_verified_at: z.string().nullable(),
    last_verification_status: z.string().nullable(),
    last_error_message: z.string().nullable(),
    model_test_results: z.any().nullable(),
  })).optional(),
  error: z.string().optional(),
})

export type AiConfigResponse = z.infer<typeof aiConfigResponseSchema>

// ============================================
// RESPONSE: UPDATE CONFIG
// ============================================

export const updateAiConfigResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type UpdateAiConfigResponse = z.infer<typeof updateAiConfigResponseSchema>
