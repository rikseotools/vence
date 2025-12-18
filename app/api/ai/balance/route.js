/**
 * GET /api/ai/balance
 * Consulta el saldo/uso de las APIs de IA
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider') || 'all'

  const results = {}

  // OpenAI - No tiene endpoint de balance directo, pero podemos verificar que funciona
  if (provider === 'all' || provider === 'openai') {
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        // OpenAI no tiene un endpoint público de balance
        // Solo podemos verificar que la key es válida
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiKey}`
          }
        })

        if (response.ok) {
          results.openai = {
            status: 'active',
            message: 'API key válida. Consulta tu uso en platform.openai.com/usage'
          }
        } else {
          const error = await response.json()
          results.openai = {
            status: 'error',
            message: error.error?.message || 'Error de autenticación'
          }
        }
      } catch (err) {
        results.openai = {
          status: 'error',
          message: err.message
        }
      }
    } else {
      results.openai = {
        status: 'not_configured',
        message: 'OPENAI_API_KEY no configurada'
      }
    }
  }

  // Anthropic (Claude)
  if (provider === 'all' || provider === 'anthropic') {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        // Anthropic tampoco tiene endpoint público de balance
        // Verificamos que la key funciona con una llamada mínima
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Di "ok"' }]
          })
        })

        const data = await response.json()

        if (response.ok) {
          results.anthropic = {
            status: 'active',
            message: 'API key válida',
            model_tested: 'claude-3-haiku-20240307',
            usage: data.usage ? {
              input_tokens: data.usage.input_tokens,
              output_tokens: data.usage.output_tokens
            } : null,
            note: 'Consulta tu uso en console.anthropic.com'
          }
        } else {
          results.anthropic = {
            status: 'error',
            message: data.error?.message || 'Error de autenticación',
            type: data.error?.type
          }
        }
      } catch (err) {
        results.anthropic = {
          status: 'error',
          message: err.message
        }
      }
    } else {
      results.anthropic = {
        status: 'not_configured',
        message: 'ANTHROPIC_API_KEY no configurada'
      }
    }
  }

  return Response.json({
    success: true,
    providers: results,
    timestamp: new Date().toISOString(),
    note: 'Para ver el saldo exacto y uso detallado, visita los dashboards de cada proveedor'
  })
}
