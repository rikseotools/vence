import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Modelos disponibles por proveedor
const AVAILABLE_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido y económico' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Más potente, más caro' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alta capacidad' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Rápido y económico' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Rápido y mejorado' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Equilibrado y potente' },
  ],
  google: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Rápido y económico' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Ultra rápido' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Más potente' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)', description: 'Última versión experimental' },
  ]
}

// Proveedores por defecto
const DEFAULT_PROVIDERS = ['openai', 'anthropic', 'google']
const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash'
}

/**
 * GET /api/admin/ai-config
 * Obtiene la configuración de todas las APIs de IA
 */
export async function GET() {
  try {
    const { data: configs, error } = await supabase
      .from('ai_api_config')
      .select('*')
      .order('provider')

    if (error) {
      console.error('Error fetching ai_api_config:', error)
      // Si la tabla no existe, devolvemos defaults
    }

    // Crear un mapa de configs existentes
    const configMap = {}
    ;(configs || []).forEach(c => {
      configMap[c.provider] = c
    })

    // Asegurar que tenemos todos los proveedores
    const allConfigs = DEFAULT_PROVIDERS.map(provider => {
      const existing = configMap[provider]
      if (existing) {
        return {
          ...existing,
          available_models: AVAILABLE_MODELS[provider] || [],
          api_key_encrypted: undefined,
          has_key: !!existing.api_key_encrypted
        }
      }
      // Crear config por defecto
      return {
        provider,
        is_active: false,
        default_model: DEFAULT_MODELS[provider],
        available_models: AVAILABLE_MODELS[provider] || [],
        has_key: false,
        api_key_hint: null,
        last_verified_at: null,
        last_verification_status: null,
        last_error_message: null
      }
    })

    return Response.json({
      success: true,
      configs: allConfigs
    })

  } catch (error) {
    console.error('Error obteniendo config IA:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/ai-config
 * Actualiza la configuración de una API de IA
 */
export async function POST(request) {
  try {
    const { provider, apiKey, defaultModel, isActive } = await request.json()

    if (!provider) {
      return Response.json({
        success: false,
        error: 'Se requiere provider'
      }, { status: 400 })
    }

    const updateData = {
      updated_at: new Date().toISOString()
    }

    // Si se proporciona API key, guardarla
    if (apiKey !== undefined) {
      if (apiKey) {
        // Guardar la key (en producción deberías encriptarla)
        // Por ahora guardamos en base64 simple
        updateData.api_key_encrypted = Buffer.from(apiKey).toString('base64')
        updateData.api_key_hint = '...' + apiKey.slice(-4)
      } else {
        // Si es vacío, borrar la key
        updateData.api_key_encrypted = null
        updateData.api_key_hint = null
      }
    }

    if (defaultModel !== undefined) {
      updateData.default_model = defaultModel
    }

    if (isActive !== undefined) {
      updateData.is_active = isActive
    }

    // Usar upsert para crear o actualizar
    const { error } = await supabase
      .from('ai_api_config')
      .upsert({
        provider,
        ...updateData,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'provider'
      })

    if (error) throw error

    return Response.json({
      success: true,
      message: `Configuración de ${provider} actualizada`
    })

  } catch (error) {
    console.error('Error actualizando config IA:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
