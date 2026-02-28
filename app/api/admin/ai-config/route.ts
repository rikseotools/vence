// app/api/admin/ai-config/route.ts
// API para gestionar configuración de APIs de IA
import { NextResponse } from 'next/server'
import { getAllConfigs, upsertConfig } from '@/lib/api/admin-ai-config'
import { updateAiConfigRequestSchema } from '@/lib/api/admin-ai-config/schemas'

// Modelos disponibles por proveedor
const AVAILABLE_MODELS: Record<string, Array<{ id: string; name: string; description: string }>> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido y económico' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Más potente, más caro' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alta capacidad' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Rápido y económico' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Equilibrado y potente' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Mejor modelo de código' },
  ],
  google: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Rápido y económico' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Ultra rápido' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Más potente' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)', description: 'Última versión experimental' },
  ],
}

const DEFAULT_PROVIDERS = ['openai', 'anthropic', 'google']
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-1.5-flash',
}

export async function GET() {
  try {
    const configs = await getAllConfigs()

    // Crear un mapa de configs existentes
    const configMap = new Map<string, (typeof configs)[number]>()
    configs.forEach(c => configMap.set(c.provider, c))

    // Asegurar que tenemos todos los proveedores
    const allConfigs = DEFAULT_PROVIDERS.map(provider => {
      const existing = configMap.get(provider)

      // Parsear resultados del test de modelos si existe
      let modelTestResults: { working?: string[]; failed?: Array<{ id: string; error: string }> } | null = null
      if (existing?.lastErrorMessage) {
        try {
          const parsed = JSON.parse(existing.lastErrorMessage)
          if (parsed.working || parsed.failed) {
            modelTestResults = parsed
          }
        } catch {
          // No es JSON, es un mensaje de error normal
        }
      }

      // Marcar modelos disponibles con su estado
      const availableModels = (AVAILABLE_MODELS[provider] || []).map(model => {
        let status = 'unknown'
        let error: string | null = null

        if (modelTestResults) {
          if (modelTestResults.working?.includes(model.id)) {
            status = 'working'
          } else if (modelTestResults.failed?.find(f => f.id === model.id)) {
            status = 'failed'
            error = modelTestResults.failed.find(f => f.id === model.id)?.error ?? null
          }
        }

        return { ...model, status, error }
      })

      if (existing) {
        return {
          provider: existing.provider,
          is_active: existing.isActive,
          default_model: existing.defaultModel,
          available_models: availableModels,
          has_key: !!existing.apiKeyEncrypted,
          api_key_hint: existing.apiKeyHint,
          last_verified_at: existing.lastVerifiedAt,
          last_verification_status: existing.lastVerificationStatus,
          last_error_message: existing.lastErrorMessage,
          model_test_results: modelTestResults,
        }
      }

      return {
        provider,
        is_active: false,
        default_model: DEFAULT_MODELS[provider],
        available_models: availableModels,
        has_key: false,
        api_key_hint: null,
        last_verified_at: null,
        last_verification_status: null,
        last_error_message: null,
        model_test_results: null,
      }
    })

    return NextResponse.json({ success: true, configs: allConfigs })
  } catch (error) {
    console.error('❌ [API/admin/ai-config] Error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = updateAiConfigRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Se requiere provider' },
        { status: 400 }
      )
    }

    const { provider, apiKey, defaultModel, isActive } = parsed.data

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (apiKey !== undefined) {
      if (apiKey) {
        updateData.apiKeyEncrypted = Buffer.from(apiKey).toString('base64')
        updateData.apiKeyHint = '...' + apiKey.slice(-4)
      } else {
        updateData.apiKeyEncrypted = null
        updateData.apiKeyHint = null
      }
    }

    if (defaultModel !== undefined) {
      updateData.defaultModel = defaultModel
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    await upsertConfig(provider, updateData)

    return NextResponse.json({
      success: true,
      message: `Configuración de ${provider} actualizada`,
    })
  } catch (error) {
    console.error('❌ [API/admin/ai-config] Error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
