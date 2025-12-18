import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/admin/ai-config/test
 * Prueba una API key y opcionalmente la guarda
 */
export async function POST(request) {
  try {
    const { provider, apiKey, model } = await request.json()

    if (!provider) {
      return Response.json({
        success: false,
        error: 'Se requiere provider'
      }, { status: 400 })
    }

    // Obtener la key: o la que nos pasan, o la guardada en BD
    let keyToTest = apiKey

    if (!keyToTest) {
      // Buscar en BD
      const { data: config } = await supabase
        .from('ai_api_config')
        .select('api_key_encrypted')
        .eq('provider', provider)
        .single()

      if (config?.api_key_encrypted) {
        keyToTest = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8')
      }
    }

    if (!keyToTest) {
      // Fallback a variables de entorno
      if (provider === 'openai') {
        keyToTest = process.env.OPENAI_API_KEY
      } else if (provider === 'anthropic') {
        keyToTest = process.env.ANTHROPIC_API_KEY
      } else if (provider === 'google') {
        keyToTest = process.env.GOOGLE_AI_API_KEY
      }
    }

    if (!keyToTest) {
      return Response.json({
        success: false,
        error: 'No hay API key configurada para este proveedor'
      }, { status: 400 })
    }

    let result

    if (provider === 'openai') {
      result = await testOpenAI(keyToTest, model || 'gpt-4o-mini')
    } else if (provider === 'anthropic') {
      result = await testAnthropic(keyToTest, model || 'claude-3-haiku-20240307')
    } else if (provider === 'google') {
      result = await testGoogle(keyToTest, model || 'gemini-1.5-flash')
    } else {
      return Response.json({
        success: false,
        error: 'Proveedor no soportado'
      }, { status: 400 })
    }

    // Actualizar estado en BD
    await supabase
      .from('ai_api_config')
      .update({
        last_verified_at: new Date().toISOString(),
        last_verification_status: result.success ? 'valid' : 'invalid',
        last_error_message: result.error || null,
        updated_at: new Date().toISOString()
      })
      .eq('provider', provider)

    return Response.json(result)

  } catch (error) {
    console.error('Error testing API:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

async function testOpenAI(apiKey, model) {
  try {
    const startTime = Date.now()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responde solo con la palabra "OK"' }],
        max_tokens: 10,
        temperature: 0
      })
    })

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        provider: 'openai',
        error: data.error?.message || 'Error de autenticación',
        errorType: data.error?.type
      }
    }

    return {
      success: true,
      provider: 'openai',
      model,
      latency,
      response: data.choices?.[0]?.message?.content,
      usage: data.usage,
      message: `API funcionando correctamente (${latency}ms)`
    }

  } catch (error) {
    return {
      success: false,
      provider: 'openai',
      error: error.message
    }
  }
}

async function testAnthropic(apiKey, model) {
  try {
    const startTime = Date.now()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Responde solo con la palabra "OK"' }]
      })
    })

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        provider: 'anthropic',
        error: data.error?.message || 'Error de autenticación',
        errorType: data.error?.type
      }
    }

    return {
      success: true,
      provider: 'anthropic',
      model,
      latency,
      response: data.content?.[0]?.text,
      usage: data.usage,
      message: `API funcionando correctamente (${latency}ms)`
    }

  } catch (error) {
    return {
      success: false,
      provider: 'anthropic',
      error: error.message
    }
  }
}

async function testGoogle(apiKey, model) {
  try {
    const startTime = Date.now()

    // Google AI Studio API (Gemini)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Responde solo con la palabra "OK"' }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0
          }
        })
      }
    )

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        provider: 'google',
        error: data.error?.message || 'Error de autenticación',
        errorType: data.error?.status
      }
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

    return {
      success: true,
      provider: 'google',
      model,
      latency,
      response: responseText,
      usage: data.usageMetadata ? {
        input_tokens: data.usageMetadata.promptTokenCount,
        output_tokens: data.usageMetadata.candidatesTokenCount,
        total_tokens: data.usageMetadata.totalTokenCount
      } : null,
      message: `API funcionando correctamente (${latency}ms)`
    }

  } catch (error) {
    return {
      success: false,
      provider: 'google',
      error: error.message
    }
  }
}
